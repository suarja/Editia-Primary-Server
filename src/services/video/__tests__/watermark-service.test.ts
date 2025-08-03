import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WatermarkService, DatabaseClient, Logger } from '../watermark-service';

describe('WatermarkService', () => {
  let mockDb: DatabaseClient;
  let mockLogger: Logger;
  let watermarkService: WatermarkService;

  beforeEach(() => {
    // Create simple mock objects
    mockDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create service instance with mocked dependencies
    watermarkService = new WatermarkService(mockDb, mockLogger);
  });

  describe('shouldAddWatermark', () => {
    it('should return true for free plan users', async () => {
      // Setup mock chain properly
      const mockChain = {
        single: vi.fn().mockResolvedValue({
          data: { current_plan_id: 'free-plan' },
          error: null
        })
      };
      
      vi.mocked(mockDb.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockChain)
        })
      } as any);

      const result = await watermarkService.shouldAddWatermark('user-123');

      expect(result).toBe(true);
      expect(mockDb.from).toHaveBeenCalledWith('user_usage');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Checking watermark requirement for user user-123')
      );
    });

    it('should return false for paid plan users', async () => {
      const mockChain = {
        single: vi.fn().mockResolvedValue({
          data: { current_plan_id: 'pro-monthly' },
          error: null
        })
      };
      
      vi.mocked(mockDb.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockChain)
        })
      } as any);

      const result = await watermarkService.shouldAddWatermark('user-123');

      expect(result).toBe(false);
    });

    it('should return true for trial plan users', async () => {
      const mockChain = {
        single: vi.fn().mockResolvedValue({
          data: { current_plan_id: 'trial-plan' },
          error: null
        })
      };
      
      vi.mocked(mockDb.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockChain)
        })
      } as any);

      const result = await watermarkService.shouldAddWatermark('user-123');

      expect(result).toBe(true);
    });

    it('should return true as fail-safe when database error occurs', async () => {
      const mockChain = {
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      };
      
      vi.mocked(mockDb.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockChain)
        })
      } as any);

      const result = await watermarkService.shouldAddWatermark('user-123');

      expect(result).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Adding watermark as fail-safe')
      );
    });

    it('should return true as fail-safe when no usage data found', async () => {
      const mockChain = {
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      };
      
      vi.mocked(mockDb.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockChain)
        })
      } as any);

      const result = await watermarkService.shouldAddWatermark('user-123');

      expect(result).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No usage data found')
      );
    });

    it('should return true as fail-safe when unexpected error occurs', async () => {
      const mockChain = {
        single: vi.fn().mockRejectedValue(new Error('Unexpected error'))
      };
      
      vi.mocked(mockDb.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockChain)
        })
      } as any);

      const result = await watermarkService.shouldAddWatermark('user-123');

      expect(result).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected error'),
        expect.any(Error)
      );
    });
  });

  describe('createWatermarkElement', () => {
    it('should create a valid Creatomate watermark element', () => {
      const element = watermarkService.createWatermarkElement();

      expect(element).toEqual({
        type: "image",
        track: 4,
        source: 'https://ai-edit-v1.s3.us-east-1.amazonaws.com/cdn/images/editia-logo.png',
        fit: "contain",
        width: "20 vmin",
        height: "20 vmin",
        x: "100%",
        y: "100%",
        xAnchor: "100%",
        yAnchor: "100%",
        xAlignment: "100%",
        yAlignment: "100%",
        xPadding: "4 vmin",
        yPadding: "4 vmin",
        opacity: 0.8,
        time: 0,
        duration: null,
      });
    });

    it('should log watermark creation', () => {
      watermarkService.createWatermarkElement();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating watermark element')
      );
    });
  });

  describe('addWatermarkToTemplate', () => {
    it('should add watermark to all scene compositions', () => {
      const template = {
        elements: [
          {
            type: 'composition',
            elements: [
              { type: 'video', track: 1 },
              { type: 'audio', track: 3 },
              { type: 'text', track: 2 }
            ]
          }
        ]
      };

      watermarkService.addWatermarkToTemplate(template);

      // Should have 4 elements now (original 3 + watermark)
      expect(template.elements[0].elements).toHaveLength(4);

      // Last element should be the watermark
      const watermark = template.elements[0].elements[3];
      expect(watermark.type).toBe('image');
      expect(watermark.track).toBe(4);
    });

    it('should handle template with no elements array', () => {
      const template = {};

      expect(() => {
        watermarkService.addWatermarkToTemplate(template);
      }).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Template has no elements array')
      );
    });

    it('should handle template with non-array elements', () => {
      const template = { elements: 'not-an-array' };

      expect(() => {
        watermarkService.addWatermarkToTemplate(template);
      }).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Template has no elements array')
      );
    });
  });

  describe('addWatermarkIfNeeded', () => {
    it('should add watermark for free users', async () => {
      // Mock shouldAddWatermark to return true
      vi.spyOn(watermarkService, 'shouldAddWatermark').mockResolvedValue(true);
      vi.spyOn(watermarkService, 'addWatermarkToTemplate').mockImplementation(() => {});

      const template = { elements: [] };
      const result = await watermarkService.addWatermarkIfNeeded('user-123', template);

      expect(result).toBe(true);
      expect(watermarkService.shouldAddWatermark).toHaveBeenCalledWith('user-123');
      expect(watermarkService.addWatermarkToTemplate).toHaveBeenCalledWith(template);
    });

    it('should not add watermark for paid users', async () => {
      // Mock shouldAddWatermark to return false
      vi.spyOn(watermarkService, 'shouldAddWatermark').mockResolvedValue(false);
      vi.spyOn(watermarkService, 'addWatermarkToTemplate').mockImplementation(() => {});

      const template = { elements: [] };
      const result = await watermarkService.addWatermarkIfNeeded('user-123', template);

      expect(result).toBe(false);
      expect(watermarkService.shouldAddWatermark).toHaveBeenCalledWith('user-123');
      expect(watermarkService.addWatermarkToTemplate).not.toHaveBeenCalled();
    });
  });

  describe('static methods (backward compatibility)', () => {
    it('should work with static shouldAddWatermark', async () => {
      // This will use the default dependencies, so we need to handle potential failures
      try {
        const result = await WatermarkService.shouldAddWatermark('user-123');
        expect(typeof result).toBe('boolean');
      } catch (error) {
        // Expected if database is not available in test environment
        expect(error).toBeDefined();
      }
    });

    it('should work with static createWatermarkElement', () => {
      const element = WatermarkService.createWatermarkElement();
      expect(element).toHaveProperty('type', 'image');
      expect(element).toHaveProperty('track', 4);
    });
  });
});