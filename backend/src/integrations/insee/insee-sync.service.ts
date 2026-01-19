import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { InseeService, MatchIdPerson } from './insee.service';
import { ProfileSource, Sex, JobStatus } from '@prisma/client';

export interface SyncResult {
  jobId: string;
  recordsProcessed: number;
  newProfiles: number;
  skippedDuplicates: number;
  errors: number;
  duration: number;
}

@Injectable()
export class InseeSyncService implements OnModuleInit {
  private readonly logger = new Logger(InseeSyncService.name);
  private isSyncing = false;
  private shouldStop = false;
  private currentJobId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inseeService: InseeService,
  ) {}

  /**
   * On service startup, clean up any orphaned RUNNING jobs from previous server instances
   */
  async onModuleInit() {
    const orphanedJobs = await this.prisma.inseeImportJob.findMany({
      where: { status: JobStatus.RUNNING },
    });

    if (orphanedJobs.length > 0) {
      this.logger.warn(
        `Found ${orphanedJobs.length} orphaned RUNNING job(s) from previous server instance. Marking as FAILED.`,
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
   * Weekly sync job - runs every Sunday at 3 AM
   */
  @Cron(CronExpression.EVERY_WEEK)
  async handleWeeklySync() {
    this.logger.log('Starting weekly INSEE sync...');

    try {
      // Get the current month
      const now = new Date();
      const currentMonth = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;

      await this.syncMonth(currentMonth);
    } catch (error) {
      this.logger.error('Weekly sync failed', error);
    }
  }

  /**
   * Sync a specific month (format: YYYYMM, e.g., "202512")
   */
  async syncMonth(yearMonth: string): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.shouldStop = false;
    const startTime = Date.now();

    // Create import job record
    const job = await this.prisma.inseeImportJob.create({
      data: {
        fileName: `matchid-api-${yearMonth}`,
        fileMonth: `${yearMonth.substring(0, 4)}-${yearMonth.substring(4, 6)}`,
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
      // Fetch and process records in batches
      for await (const batch of this.inseeService.fetchForMonth(yearMonth)) {
        // Check if stop was requested
        if (this.shouldStop) {
          this.logger.log('Sync stop requested, finishing current batch...');
          wasStopped = true;
          break;
        }

        for (const person of batch) {
          try {
            const created = await this.processRecord(person);
            recordsProcessed++;

            if (created) {
              newProfiles++;
            } else {
              skippedDuplicates++;
            }
          } catch (error) {
            errors++;
            this.logger.error(`Failed to process record ${person.id}`, error);
          }
        }

        // Update job progress
        await this.prisma.inseeImportJob.update({
          where: { id: job.id },
          data: {
            processedCount: recordsProcessed,
            newProfiles,
          },
        });
      }

      // Mark job as completed or stopped
      await this.prisma.inseeImportJob.update({
        where: { id: job.id },
        data: {
          status: wasStopped ? JobStatus.CANCELLED : JobStatus.COMPLETED,
          recordCount: recordsProcessed,
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
      // Mark job as failed
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
      recordsProcessed,
      newProfiles,
      skippedDuplicates,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Sync a full year (for initial data load)
   */
  async syncYear(year: string): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.shouldStop = false;
    const startTime = Date.now();

    const job = await this.prisma.inseeImportJob.create({
      data: {
        fileName: `matchid-api-${year}`,
        fileMonth: year,
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
      for await (const batch of this.inseeService.fetchAllForYear(year)) {
        // Check if stop was requested
        if (this.shouldStop) {
          this.logger.log('Sync stop requested, finishing current batch...');
          wasStopped = true;
          break;
        }

        for (const person of batch) {
          try {
            const created = await this.processRecord(person);
            recordsProcessed++;

            if (created) {
              newProfiles++;
            } else {
              skippedDuplicates++;
            }
          } catch (error) {
            errors++;
            this.logger.error(`Failed to process record ${person.id}`, error);
          }
        }

        // Update progress every batch
        await this.prisma.inseeImportJob.update({
          where: { id: job.id },
          data: {
            processedCount: recordsProcessed,
            newProfiles,
          },
        });
      }

      await this.prisma.inseeImportJob.update({
        where: { id: job.id },
        data: {
          status: wasStopped ? JobStatus.CANCELLED : JobStatus.COMPLETED,
          recordCount: recordsProcessed,
          processedCount: recordsProcessed,
          newProfiles,
          errorMessage: wasStopped ? 'Stopped by user' : null,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Year sync ${wasStopped ? 'stopped' : 'completed'}: ${recordsProcessed} processed, ${newProfiles} new, ${skippedDuplicates} duplicates`,
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
      recordsProcessed,
      newProfiles,
      skippedDuplicates,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Helper to extract city name from API response (can be string or array)
   */
  private extractCity(city: string | string[] | undefined): string | null {
    if (!city) return null;
    if (Array.isArray(city)) return city[0] || null;
    return city;
  }

  /**
   * Process a single matchID record and create/update profile
   */
  private async processRecord(person: MatchIdPerson): Promise<boolean> {
    // Build unique key - handle missing fields gracefully
    const deathCode = person.death.location?.code || 'unknown';
    const deathDate = person.death.date;
    const certId = person.death.certificateId || person.id;
    const inseeKey = `${deathCode}-${deathDate}-${certId}`;

    const existing = await this.prisma.profile.findFirst({
      where: {
        inseeNumActe: inseeKey,
      },
    });

    if (existing) {
      // Already imported
      return false;
    }

    // Parse dates
    const birthDate = this.inseeService.parseDate(person.birth.date);
    const parsedDeathDate = this.inseeService.parseDate(person.death.date);

    if (!parsedDeathDate) {
      this.logger.warn(`Invalid death date for ${person.id}: ${person.death.date}`);
      return false;
    }

    // Extract names - required fields
    const firstName = person.name.first[0] || 'Unknown';
    const lastName = person.name.last || 'Unknown';
    
    // Generate slug
    const slug = this.inseeService.generateSlug(firstName, lastName, person.death.date);

    // Check slug uniqueness, add suffix if needed
    let finalSlug = slug;
    let suffix = 1;
    while (await this.prisma.profile.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${suffix}`;
      suffix++;
    }

    // Extract optional location data
    const birthPlaceLabel = this.extractCity(person.birth.location?.city);
    const deathPlaceLabel = this.extractCity(person.death.location?.city);

    // Create profile with required + optional fields
    await this.prisma.profile.create({
      data: {
        slug: finalSlug,
        firstName,
        lastName,
        birthDate: birthDate || null,
        deathDate: parsedDeathDate,
        sex: person.sex === 'M' ? Sex.MALE : person.sex === 'F' ? Sex.FEMALE : null,

        // Birth location (all optional)
        birthPlaceCog: person.birth.location?.code || null,
        birthPlaceLabel,

        // Death location (all optional)
        deathPlaceCog: person.death.location?.code || null,
        deathPlaceLabel,

        // Map pin - only set if we have valid coordinates
        pinLat: person.death.location?.latitude ?? null,
        pinLng: person.death.location?.longitude ?? null,

        // Provenance
        source: ProfileSource.INSEE,
        inseeNumActe: inseeKey,
      },
    });

    return true;
  }

  /**
   * Stop the current sync job
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
   * Get sync status and recent jobs
   */
  async getSyncStatus() {
    const recentJobs = await this.prisma.inseeImportJob.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    const totalProfiles = await this.prisma.profile.count({
      where: { source: ProfileSource.INSEE },
    });

    return {
      isSyncing: this.isSyncing,
      totalInseeProfiles: totalProfiles,
      recentJobs,
    };
  }
}

