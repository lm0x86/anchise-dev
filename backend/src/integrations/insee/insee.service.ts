import { Injectable, Logger } from '@nestjs/common';

const MATCHID_API_URL = 'https://deces.matchid.io/deces/api/v1/search';
const PAGE_SIZE = 20; // Max allowed by the API

export interface MatchIdPerson {
  id: string;
  score: number;
  source: string;
  sourceLine: number;
  name: {
    first: string[];
    last: string;
  };
  sex?: 'M' | 'F';
  birth: {
    date: string; // YYYYMMDD
    location: {
      city?: string | string[]; // Can be array with historical names
      code?: string;
      departmentCode?: string;
      country?: string;
      countryCode?: string;
      latitude?: number;
      longitude?: number;
    };
  };
  death: {
    date: string; // YYYYMMDD
    certificateId?: string;
    age?: number;
    location: {
      city?: string | string[]; // Can be array with historical names
      code?: string;
      departmentCode?: string;
      country?: string;
      countryCode?: string;
      latitude?: number;
      longitude?: number;
    };
  };
}

export interface MatchIdResponse {
  request: Record<string, unknown>;
  response: {
    total: number;
    maxScoreES: number;
    size: number;
    page: number;
    delay: number;
    persons: MatchIdPerson[];
    scrollId?: string;
  };
}

export interface InseeSearchParams {
  page?: number;
  size?: number;
  deathDate?: string; // Year "2024" or French date range "01/12/2025-31/12/2025"
  scroll?: string;
  scrollId?: string;
}

@Injectable()
export class InseeService {
  private readonly logger = new Logger(InseeService.name);

  /**
   * Search the matchID API for death records
   * API docs: https://deces.matchid.io/link/api
   * Date formats: "2024" (year) or "01/12/2025-31/12/2025" (French date range DD/MM/YYYY)
   */
  async search(params: InseeSearchParams): Promise<MatchIdResponse> {
    const body: Record<string, unknown> = {
      page: params.page || 1,
      size: params.size || PAGE_SIZE,
      sort: [{ score: 'desc' }],
      fuzzy: 'false',
    };

    if (params.deathDate) {
      body.deathDate = params.deathDate;
    }

    // Scroll for deep pagination
    if (params.scroll) {
      body.scroll = params.scroll;
    }
    if (params.scrollId) {
      body.scrollId = params.scrollId;
    }

    this.logger.debug(`API request: ${JSON.stringify(body)}`);

    try {
      const response = await fetch(MATCHID_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`API error response: ${errorText}`);
        throw new Error(`matchID API error: ${response.status} - ${errorText}`);
      }

      return response.json() as Promise<MatchIdResponse>;
    } catch (error) {
      this.logger.error('Failed to fetch from matchID API', error);
      throw error;
    }
  }

  /**
   * Fetch all records for a given year, handling pagination
   * Yields batches of persons for memory efficiency
   */
  async *fetchAllForYear(year: string): AsyncGenerator<MatchIdPerson[], void, unknown> {
    this.logger.log(`Starting fetch for year ${year}`);

    // First request to get total and initial data
    let result = await this.search({
      deathDate: year,
      page: 1,
      size: PAGE_SIZE,
      scroll: '5m', // Keep scroll context alive for 5 minutes
    });

    const total = result.response.total;
    this.logger.log(`Total records for ${year}: ${total}`);

    yield result.response.persons;

    let fetched = result.response.persons.length;
    let scrollId = result.response.scrollId;

    // Continue with scroll for remaining pages
    while (fetched < total && scrollId) {
      result = await this.search({
        scrollId,
        scroll: '5m',
      });

      if (result.response.persons.length === 0) {
        break;
      }

      yield result.response.persons;
      fetched += result.response.persons.length;
      scrollId = result.response.scrollId;

      this.logger.log(`Fetched ${fetched}/${total} records`);

      // Small delay to be respectful to the API
      await this.sleep(100);
    }

    this.logger.log(`Completed fetch for ${year}: ${fetched} records`);
  }

  /**
   * Fetch records for a specific month (e.g., "202512" for December 2025)
   * The matchID API accepts date ranges in French format: "DD/MM/YYYY-DD/MM/YYYY"
   */
  async *fetchForMonth(yearMonth: string): AsyncGenerator<MatchIdPerson[], void, unknown> {
    const year = yearMonth.substring(0, 4);
    const month = yearMonth.substring(4, 6);

    // Calculate date range for the month (French format: DD/MM/YYYY)
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const startDate = `01/${month}/${year}`;
    const endDate = `${lastDay.toString().padStart(2, '0')}/${month}/${year}`;
    const dateRange = `${startDate}-${endDate}`;

    this.logger.log(`Fetching records for ${year}-${month} (${dateRange})`);

    // Use scroll-based pagination for large result sets
    let result = await this.search({
      deathDate: dateRange,
      page: 1,
      size: PAGE_SIZE,
      scroll: '5m',
    });

    const total = result.response.total;
    this.logger.log(`Total records for ${year}-${month}: ${total}`);

    if (result.response.persons.length === 0) {
      this.logger.log(`No records found for ${year}-${month}`);
      return;
    }

    yield result.response.persons;

    let fetched = result.response.persons.length;
    let scrollId = result.response.scrollId;

    // Continue with scroll for remaining pages
    while (fetched < total && scrollId) {
      result = await this.search({
        scrollId,
        scroll: '5m',
      });

      if (result.response.persons.length === 0) {
        break;
      }

      yield result.response.persons;
      fetched += result.response.persons.length;
      scrollId = result.response.scrollId;

      this.logger.log(`Fetched ${fetched}/${total} records for ${year}-${month}`);

      // Respectful delay
      await this.sleep(100);
    }

    this.logger.log(`Completed fetch for ${year}-${month}: ${fetched} records`);
  }

  /**
   * Parse YYYYMMDD to Date object
   */
  parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.length !== 8) {
      return null;
    }

    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
    const day = parseInt(dateStr.substring(6, 8));

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return null;
    }

    return new Date(year, month, day);
  }

  /**
   * Generate a URL-safe slug from name
   */
  generateSlug(firstName: string, lastName: string, deathDate: string): string {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const namePart = normalize(`${firstName}-${lastName}`);
    const datePart = deathDate.substring(0, 8); // YYYYMMDD

    // Add a short hash for uniqueness
    const hash = this.simpleHash(`${firstName}${lastName}${deathDate}`);

    return `${namePart}-${datePart}-${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 6);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

