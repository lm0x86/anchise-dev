import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileSource, Sex, JobStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { parse } from 'csv-parse';
import { Extract } from 'unzip-stream';

const INSEE_FILES_URL = 'https://www.insee.fr/fr/information/4190491';
const SYNC_DATA_DIR = path.join(process.cwd(), 'sync-data');

export interface InseeFileInfo {
  fileName: string;
  url: string;
  month: string; // e.g., "2025-12"
  year: string;
  type: 'monthly' | 'annual' | 'decennial';
}

interface CsvRecord {
  nomprenom: string;
  sexe: string;
  datenaiss: string;
  lieunaiss: string;
  commnaiss: string;
  paysnaiss: string;
  datedeces: string;
  lieudeces: string;
  actedeces: string;
}

export interface FileSyncResult {
  jobId: string;
  fileName: string;
  recordsProcessed: number;
  newProfiles: number;
  skippedDuplicates: number;
  errors: number;
  duration: number;
}

@Injectable()
export class InseeFileSyncService implements OnModuleInit {
  private readonly logger = new Logger(InseeFileSyncService.name);
  private isSyncing = false;
  private shouldStop = false;
  private currentJobId: string | null = null;

  // Cache for geocoding COG codes to coordinates
  private geocodeCache = new Map<string, { lat: number; lng: number } | null>();

  // Spread radius in degrees (~200-300 meters at French latitudes)
  // 0.001 degree ≈ 111 meters at equator, ~80 meters at 45°N latitude
  private readonly SPREAD_RADIUS = 0.003; // ~250 meters spread

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Ensure sync-data directory exists
    if (!fs.existsSync(SYNC_DATA_DIR)) {
      fs.mkdirSync(SYNC_DATA_DIR, { recursive: true });
      this.logger.log(`Created sync-data directory: ${SYNC_DATA_DIR}`);
    }

    // Clean up orphaned jobs
    const orphanedJobs = await this.prisma.inseeImportJob.findMany({
      where: { status: JobStatus.RUNNING },
    });

    if (orphanedJobs.length > 0) {
      this.logger.warn(
        `Found ${orphanedJobs.length} orphaned RUNNING job(s). Marking as FAILED.`,
      );

      await this.prisma.inseeImportJob.updateMany({
        where: { status: JobStatus.RUNNING },
        data: {
          status: JobStatus.FAILED,
          errorMessage: 'Server restarted while job was running',
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Daily check for new INSEE files - runs every day at 4 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleDailyCheck() {
    this.logger.log('Starting daily INSEE file check...');

    try {
      const availableFiles = await this.scrapeAvailableFiles();
      const newFiles = await this.findNewFiles(availableFiles);

      if (newFiles.length === 0) {
        this.logger.log('No new INSEE files found');
        return;
      }

      this.logger.log(`Found ${newFiles.length} new file(s) to process`);

      // Process monthly files first (most recent data)
      const monthlyFiles = newFiles.filter((f) => f.type === 'monthly');
      for (const file of monthlyFiles) {
        await this.downloadAndProcessFile(file);
      }
    } catch (error) {
      this.logger.error('Daily INSEE check failed', error);
    }
  }

  /**
   * Scrape the INSEE website to get list of available files
   */
  async scrapeAvailableFiles(): Promise<InseeFileInfo[]> {
    this.logger.log('Scraping INSEE website for available files...');

    const html = await this.fetchPage(INSEE_FILES_URL);
    const files: InseeFileInfo[] = [];

    // Parse download links from the page
    // Monthly files: Deces_YYYY_MMM.zip (e.g., Deces_2025_M12.zip)
    // Annual files: deces-YYYY.zip
    // Decennial files: deces-YYYY-YYYY.zip

    // Match monthly file links
    const monthlyRegex =
      /href="([^"]*\/Deces_(\d{4})_M(\d{1,2})\.zip)"/gi;
    let match;

    while ((match = monthlyRegex.exec(html)) !== null) {
      const url = match[1].startsWith('http')
        ? match[1]
        : `https://www.insee.fr${match[1]}`;
      const year = match[2];
      const month = match[3].padStart(2, '0');

      files.push({
        fileName: `Deces_${year}_M${month}.zip`,
        url,
        month: `${year}-${month}`,
        year,
        type: 'monthly',
      });
    }

    // Match annual file links
    const annualRegex = /href="([^"]*\/deces-(\d{4})\.zip)"/gi;
    while ((match = annualRegex.exec(html)) !== null) {
      const url = match[1].startsWith('http')
        ? match[1]
        : `https://www.insee.fr${match[1]}`;
      const year = match[2];

      files.push({
        fileName: `deces-${year}.zip`,
        url,
        month: year,
        year,
        type: 'annual',
      });
    }

    this.logger.log(`Found ${files.length} files on INSEE website`);
    return files;
  }

  /**
   * Find files that haven't been processed yet
   */
  async findNewFiles(availableFiles: InseeFileInfo[]): Promise<InseeFileInfo[]> {
    const processedFiles = await this.prisma.inseeImportJob.findMany({
      where: {
        status: { in: [JobStatus.COMPLETED, JobStatus.RUNNING] },
      },
      select: { fileName: true },
    });

    const processedSet = new Set(processedFiles.map((j) => j.fileName));

    return availableFiles.filter((f) => !processedSet.has(f.fileName));
  }

  /**
   * Download and process a single INSEE file
   */
  async downloadAndProcessFile(file: InseeFileInfo): Promise<FileSyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.shouldStop = false;
    const startTime = Date.now();

    // Create job record
    const job = await this.prisma.inseeImportJob.create({
      data: {
        fileName: file.fileName,
        fileMonth: file.month,
        recordCount: 0,
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    this.currentJobId = job.id;

    let recordsProcessed = 0;
    let newProfiles = 0;
    let skippedDuplicates = 0;
    let errors = 0;
    let wasStopped = false;

    try {
      // Download the file
      const localPath = path.join(SYNC_DATA_DIR, file.fileName);
      await this.downloadFile(file.url, localPath);
      this.logger.log(`Downloaded ${file.fileName}`);

      // Extract and process
      const csvPath = await this.extractZip(localPath);
      this.logger.log(`Extracted to ${csvPath}`);

      // Count total records first
      const totalRecords = await this.countCsvRecords(csvPath);
      await this.prisma.inseeImportJob.update({
        where: { id: job.id },
        data: { recordCount: totalRecords },
      });
      this.logger.log(`Total records in file: ${totalRecords}`);

      // Process CSV records
      for await (const record of this.parseCsv(csvPath)) {
        if (this.shouldStop) {
          this.logger.log('Sync stop requested, finishing current batch...');
          wasStopped = true;
          break;
        }

        try {
          const created = await this.processRecord(record);
          recordsProcessed++;

          if (created) {
            newProfiles++;
          } else {
            skippedDuplicates++;
          }
        } catch (error) {
          errors++;
          if (errors <= 10) {
            this.logger.error(`Failed to process record`, error);
          }
        }

        // Update progress every 1000 records
        if (recordsProcessed % 1000 === 0) {
          await this.prisma.inseeImportJob.update({
            where: { id: job.id },
            data: {
              processedCount: recordsProcessed,
              newProfiles,
            },
          });
          this.logger.log(
            `Progress: ${recordsProcessed}/${totalRecords} (${newProfiles} new, ${skippedDuplicates} duplicates, ${errors} errors)`,
          );
        }
      }

      // Mark job complete
      await this.prisma.inseeImportJob.update({
        where: { id: job.id },
        data: {
          status: wasStopped ? JobStatus.CANCELLED : JobStatus.COMPLETED,
          processedCount: recordsProcessed,
          newProfiles,
          errorMessage: wasStopped ? 'Stopped by user' : null,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Sync ${wasStopped ? 'stopped' : 'completed'}: ${recordsProcessed} processed, ${newProfiles} new, ${skippedDuplicates} duplicates, ${errors} errors`,
      );
    } catch (error) {
      await this.prisma.inseeImportJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });

      throw error;
    } finally {
      this.isSyncing = false;
      this.shouldStop = false;
      this.currentJobId = null;
    }

    return {
      jobId: job.id,
      fileName: file.fileName,
      recordsProcessed,
      newProfiles,
      skippedDuplicates,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Manually trigger sync for a specific file (already downloaded)
   */
  async syncLocalFile(fileName: string): Promise<FileSyncResult> {
    const localPath = path.join(SYNC_DATA_DIR, fileName);

    if (!fs.existsSync(localPath)) {
      throw new Error(`File not found: ${localPath}`);
    }

    // Parse file info from name
    const monthlyMatch = fileName.match(/Deces_(\d{4})_M(\d{1,2})\.zip/i);
    const annualMatch = fileName.match(/deces-(\d{4})\.zip/i);

    let month: string;
    let year: string;
    let type: 'monthly' | 'annual' = 'monthly';

    if (monthlyMatch) {
      year = monthlyMatch[1];
      month = `${year}-${monthlyMatch[2].padStart(2, '0')}`;
    } else if (annualMatch) {
      year = annualMatch[1];
      month = year;
      type = 'annual';
    } else {
      throw new Error(`Cannot parse file name: ${fileName}`);
    }

    const file: InseeFileInfo = {
      fileName,
      url: '', // Local file, no URL needed
      month,
      year,
      type,
    };

    return this.processLocalFile(file, localPath);
  }

  /**
   * Process an already-downloaded local file
   */
  private async processLocalFile(
    file: InseeFileInfo,
    localPath: string,
  ): Promise<FileSyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.shouldStop = false;
    const startTime = Date.now();

    const job = await this.prisma.inseeImportJob.create({
      data: {
        fileName: file.fileName,
        fileMonth: file.month,
        recordCount: 0,
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    this.currentJobId = job.id;

    let recordsProcessed = 0;
    let newProfiles = 0;
    let skippedDuplicates = 0;
    let errors = 0;
    let wasStopped = false;

    try {
      // Extract ZIP
      const csvPath = await this.extractZip(localPath);
      this.logger.log(`Extracted to ${csvPath}`);

      // Count records
      const totalRecords = await this.countCsvRecords(csvPath);
      await this.prisma.inseeImportJob.update({
        where: { id: job.id },
        data: { recordCount: totalRecords },
      });
      this.logger.log(`Total records: ${totalRecords}`);

      // Process
      for await (const record of this.parseCsv(csvPath)) {
        if (this.shouldStop) {
          wasStopped = true;
          break;
        }

        try {
          const created = await this.processRecord(record);
          recordsProcessed++;

          if (created) {
            newProfiles++;
          } else {
            skippedDuplicates++;
          }
        } catch (error) {
          errors++;
          if (errors <= 10) {
            this.logger.error(`Failed to process record`, error);
          }
        }

        if (recordsProcessed % 1000 === 0) {
          await this.prisma.inseeImportJob.update({
            where: { id: job.id },
            data: { processedCount: recordsProcessed, newProfiles },
          });
          this.logger.log(
            `Progress: ${recordsProcessed}/${totalRecords} (${newProfiles} new)`,
          );
        }
      }

      await this.prisma.inseeImportJob.update({
        where: { id: job.id },
        data: {
          status: wasStopped ? JobStatus.CANCELLED : JobStatus.COMPLETED,
          processedCount: recordsProcessed,
          newProfiles,
          errorMessage: wasStopped ? 'Stopped by user' : null,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Sync ${wasStopped ? 'stopped' : 'completed'}: ${recordsProcessed} processed, ${newProfiles} new`,
      );
    } catch (error) {
      await this.prisma.inseeImportJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
      throw error;
    } finally {
      this.isSyncing = false;
      this.shouldStop = false;
      this.currentJobId = null;
    }

    return {
      jobId: job.id,
      fileName: file.fileName,
      recordsProcessed,
      newProfiles,
      skippedDuplicates,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Process a single CSV record
   * Returns true if new profile created, false if duplicate/skipped
   */
  private async processRecord(record: CsvRecord): Promise<boolean> {
    // Build unique key from: death place + death date + certificate number
    const inseeKey = `${record.lieudeces}-${record.datedeces}-${record.actedeces}`;

    // Check for existing record (application-level check)
    const existing = await this.prisma.profile.findFirst({
      where: { inseeNumActe: inseeKey },
    });

    if (existing) {
      return false; // Duplicate - skip
    }

    // Parse name: "LASTNAME*FIRSTNAME1 FIRSTNAME2.../"
    const { firstName, lastName } = this.parseName(record.nomprenom);

    if (!firstName || !lastName) {
      this.logger.warn(`Invalid name format: ${record.nomprenom}`);
      return false;
    }

    // Parse dates
    const birthDate = this.parseDate(record.datenaiss);
    const deathDate = this.parseDate(record.datedeces);

    if (!deathDate) {
      this.logger.warn(`Invalid death date: ${record.datedeces}`);
      return false;
    }

    // Generate slug
    const slug = this.generateSlug(firstName, lastName, record.datedeces);
    let finalSlug = slug;
    let suffix = 1;
    while (await this.prisma.profile.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${suffix}`;
      suffix++;
    }

    // Try to get coordinates for death location
    const baseCoords = await this.geocodeCog(record.lieudeces);
    
    // Apply jitter to spread markers within the same location
    const coords = baseCoords ? this.jitterCoordinates(baseCoords) : null;

    // Create profile (with unique constraint protection)
    try {
      await this.prisma.profile.create({
        data: {
          slug: finalSlug,
          firstName,
          lastName,
          birthDate: birthDate || null,
          deathDate,
          sex: record.sexe === '1' ? Sex.MALE : record.sexe === '2' ? Sex.FEMALE : null,

          // Birth location
          birthPlaceCog: record.lieunaiss || null,
          birthPlaceLabel: record.commnaiss || null,

          // Death location
          deathPlaceCog: record.lieudeces || null,
          deathPlaceLabel: null, // INSEE files don't include death place name

          // Map pin (with jitter applied for visual spread)
          pinLat: coords?.lat ?? null,
          pinLng: coords?.lng ?? null,

          // Provenance
          source: ProfileSource.INSEE,
          inseeNumActe: inseeKey,
        },
      });

      return true;
    } catch (error) {
      // Handle unique constraint violation (race condition)
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint')
      ) {
        return false; // Duplicate detected by database
      }
      throw error; // Re-throw other errors
    }
  }

  /**
   * Parse INSEE name format: "LASTNAME*FIRSTNAME1 FIRSTNAME2.../"
   */
  private parseName(nomprenom: string): { firstName: string; lastName: string } {
    // Remove trailing slash
    const cleaned = nomprenom.replace(/\/$/, '').trim();

    // Split by asterisk
    const parts = cleaned.split('*');
    if (parts.length < 2) {
      return { firstName: '', lastName: cleaned };
    }

    const lastName = parts[0].trim();
    const firstNames = parts[1].trim();

    // Take first name only (first word before space)
    const firstName = firstNames.split(' ')[0] || '';

    return {
      firstName: this.formatName(firstName),
      lastName: this.formatName(lastName),
    };
  }

  /**
   * Format name to title case
   */
  private formatName(name: string): string {
    return name
      .toLowerCase()
      .split(/[-\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-')
      .replace(/-$/, '');
  }

  /**
   * Parse YYYYMMDD date
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.length !== 8) {
      return null;
    }

    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return null;
    }

    // Handle partial dates (day=0 means unknown day)
    const actualDay = day === 0 ? 1 : day;

    return new Date(year, month, actualDay);
  }

  /**
   * Generate URL-safe slug
   */
  private generateSlug(firstName: string, lastName: string, deathDate: string): string {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const namePart = normalize(`${firstName}-${lastName}`);
    const datePart = deathDate.substring(0, 8);
    const hash = this.simpleHash(`${firstName}${lastName}${deathDate}`);

    return `${namePart}-${datePart}-${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 6);
  }

  /**
   * Geocode a COG code to lat/lng using the French government API
   */
  private async geocodeCog(
    cogCode: string,
  ): Promise<{ lat: number; lng: number } | null> {
    if (!cogCode) return null;

    // Check cache
    if (this.geocodeCache.has(cogCode)) {
      return this.geocodeCache.get(cogCode) || null;
    }

    try {
      // Use geo.api.gouv.fr to get commune coordinates
      const response = await fetch(
        `https://geo.api.gouv.fr/communes/${cogCode}?fields=centre`,
      );

      if (!response.ok) {
        this.geocodeCache.set(cogCode, null);
        return null;
      }

      const data = (await response.json()) as {
        centre?: { coordinates?: [number, number] };
      };

      if (data.centre?.coordinates) {
        const [lng, lat] = data.centre.coordinates;
        const coords = { lat, lng };
        this.geocodeCache.set(cogCode, coords);
        return coords;
      }
    } catch {
      // Geocoding failed, cache null to avoid repeated failures
      this.geocodeCache.set(cogCode, null);
    }

    return null;
  }

  /**
   * Add small random offset to coordinates to spread markers visually
   * Uses uniform distribution in a circle around the base point
   */
  private jitterCoordinates(coords: {
    lat: number;
    lng: number;
  }): { lat: number; lng: number } {
    // Random angle (0 to 2π)
    const angle = Math.random() * 2 * Math.PI;
    
    // Random radius with sqrt for uniform distribution in circle
    const radius = Math.sqrt(Math.random()) * this.SPREAD_RADIUS;
    
    // Calculate offset
    const latOffset = radius * Math.cos(angle);
    const lngOffset = radius * Math.sin(angle);

    return {
      lat: coords.lat + latOffset,
      lng: coords.lng + lngOffset,
    };
  }

  /**
   * Fetch HTML page content
   */
  private fetchPage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Anchise/1.0' } }, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            this.fetchPage(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * Download file from URL
   */
  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath);

      https.get(url, { headers: { 'User-Agent': 'Anchise/1.0' } }, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            file.close();
            fs.unlinkSync(destPath);
            this.downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
            return;
          }
        }

        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {}); // Clean up
        reject(err);
      });
    });
  }

  /**
   * Extract ZIP file and return path to CSV
   */
  private extractZip(zipPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const extractDir = path.dirname(zipPath);
      let csvPath = '';

      createReadStream(zipPath)
        .pipe(Extract({ path: extractDir }))
        .on('entry', (entry: { path: string; type: string }) => {
          if (entry.path.endsWith('.csv')) {
            csvPath = path.join(extractDir, entry.path);
          }
        })
        .on('close', () => {
          if (csvPath) {
            resolve(csvPath);
          } else {
            // Look for CSV in directory
            const files = fs.readdirSync(extractDir);
            const csv = files.find((f) => f.endsWith('.csv'));
            if (csv) {
              resolve(path.join(extractDir, csv));
            } else {
              reject(new Error('No CSV file found in ZIP'));
            }
          }
        })
        .on('error', reject);
    });
  }

  /**
   * Count records in CSV file
   */
  private countCsvRecords(csvPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;

      createReadStream(csvPath)
        .pipe(
          parse({
            delimiter: ';',
            columns: true,
            skip_empty_lines: true,
            relax_quotes: true,
          }),
        )
        .on('data', () => count++)
        .on('end', () => resolve(count))
        .on('error', reject);
    });
  }

  /**
   * Parse CSV file as async generator
   */
  private async *parseCsv(csvPath: string): AsyncGenerator<CsvRecord> {
    const parser = createReadStream(csvPath).pipe(
      parse({
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        encoding: 'utf8',
      }),
    );

    for await (const record of parser) {
      yield record as CsvRecord;
    }
  }

  /**
   * Stop current sync
   */
  async stopSync(): Promise<{ stopped: boolean; jobId: string | null }> {
    if (!this.isSyncing || !this.currentJobId) {
      return { stopped: false, jobId: null };
    }

    this.logger.log(`Stopping sync job ${this.currentJobId}...`);
    this.shouldStop = true;

    return { stopped: true, jobId: this.currentJobId };
  }

  /**
   * Get list of local files available for processing
   */
  async getLocalFiles(): Promise<
    { fileName: string; size: number; processed: boolean }[]
  > {
    if (!fs.existsSync(SYNC_DATA_DIR)) {
      return [];
    }

    const files = fs.readdirSync(SYNC_DATA_DIR).filter((f) => f.endsWith('.zip'));

    const processedFiles = await this.prisma.inseeImportJob.findMany({
      where: { status: JobStatus.COMPLETED },
      select: { fileName: true },
    });
    const processedSet = new Set(processedFiles.map((j) => j.fileName));

    return files.map((fileName) => {
      const filePath = path.join(SYNC_DATA_DIR, fileName);
      const stats = fs.statSync(filePath);
      return {
        fileName,
        size: stats.size,
        processed: processedSet.has(fileName),
      };
    });
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    const recentJobs = await this.prisma.inseeImportJob.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    const totalProfiles = await this.prisma.profile.count({
      where: { source: ProfileSource.INSEE },
    });

    const localFiles = await this.getLocalFiles();

    return {
      isSyncing: this.isSyncing,
      currentJobId: this.currentJobId,
      totalInseeProfiles: totalProfiles,
      localFiles,
      recentJobs,
    };
  }

  /**
   * Manually check for new files (trigger outside of cron)
   */
  async checkForNewFiles(): Promise<InseeFileInfo[]> {
    const availableFiles = await this.scrapeAvailableFiles();
    return this.findNewFiles(availableFiles);
  }
}
