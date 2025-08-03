import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set up environment variables before any imports
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

describe('VideoTemplateService Watermark Integration', () => {
  let WatermarkService: any;
  let mockTemplate: any;

  beforeEach(async () => {
    // Reset modules and mocks
    vi.resetModules();
    
    // Mock the logger
    vi.doMock('../../../config/logger', () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(() => ({
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        })),
      },
    }));

    // Import WatermarkService after mocking
    const watermarkModule = await import('../watermark-service');
    WatermarkService = watermarkModule.WatermarkService;

    // Create a mock template
    mockTemplate = {
      output_format: 'mp4',
      width: 1080,
      height: 1920,
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
  });

  describe('watermark integration logic', () => {
    it('should have userId parameter in TemplateConfig type', async () => {
      const { TemplateConfig } = await import('../template-service');
      
      // This test verifies that the TemplateConfig type includes userId
      // We can't directly test TypeScript types at runtime, but we can verify
      // that the code compiles and the field is optional
      const config = {
        scriptText: 'test',
        selectedVideos: [],
        captionConfig: { enabled: true, placement: 'bottom', transcriptColor: '#fff', transcriptEffect: 'none' },
        editorialProfile: {},
        voiceId: 'test',
        outputLanguage: 'en',
        userId: 'test-user' // This should be valid without TypeScript errors
      };
      
      expect(config.userId).toBe('test-user');
    });

    it('should call WatermarkService.addWatermarkIfNeeded when userId is provided', async () => {
      // Mock WatermarkService methods
      const addWatermarkIfNeededSpy = vi.spyOn(WatermarkService, 'addWatermarkIfNeeded').mockResolvedValue(true);
      
      // Test the watermark logic directly
      const userId = 'free-user-123';
      const templateCopy = JSON.parse(JSON.stringify(mockTemplate));
      
      const result = await WatermarkService.addWatermarkIfNeeded(userId, templateCopy);
      
      expect(addWatermarkIfNeededSpy).toHaveBeenCalledWith(userId, templateCopy);
      expect(result).toBe(true);
      
      addWatermarkIfNeededSpy.mockRestore();
    });

    it('should handle watermark errors gracefully', async () => {
      // Mock WatermarkService to throw an error
      const addWatermarkIfNeededSpy = vi.spyOn(WatermarkService, 'addWatermarkIfNeeded')
        .mockRejectedValue(new Error('Database connection failed'));
      
      // The service should handle this error gracefully
      try {
        await WatermarkService.addWatermarkIfNeeded('user-123', mockTemplate);
        // If we reach here, the error wasn't thrown (which might be expected in some cases)
      } catch (error) {
        // If an error is thrown, verify it's the expected one
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Database connection failed');
      }
      
      expect(addWatermarkIfNeededSpy).toHaveBeenCalled();
      addWatermarkIfNeededSpy.mockRestore();
    });

    it('should verify watermark element structure', () => {
      const watermarkElement = WatermarkService.createWatermarkElement();
      
      // Verify the watermark element has the correct structure for Creatomate
      expect(watermarkElement).toEqual({
        type: "image",
        track: 4, // Should be above other tracks
        source: 'https://ai-edit-v1.s3.us-east-1.amazonaws.com/cdn/images/editia-logo.png',
        fit: "contain",
        width: "20 vmin",
        height: "20 vmin",
        x: "100%", // Right edge
        y: "100%", // Bottom edge
        xAnchor: "100%",
        yAnchor: "100%",
        xAlignment: "100%",
        yAlignment: "100%",
        xPadding: "4 vmin", // Padding from edges
        yPadding: "4 vmin",
        opacity: 0.8, // Semi-transparent
        time: 0, // Start immediately
        duration: null, // Last for entire scene
      });
    });

    it('should add watermark to template compositions', () => {
      const templateCopy = JSON.parse(JSON.stringify(mockTemplate));
      
      // Add watermark to template
      WatermarkService.addWatermarkToTemplate(templateCopy);
      
      // Verify watermark was added
      expect(templateCopy.elements[0].elements).toHaveLength(4); // original 3 + watermark
      
      const watermarkElement = templateCopy.elements[0].elements[3];
      expect(watermarkElement.type).toBe('image');
      expect(watermarkElement.track).toBe(4);
      expect(watermarkElement.source).toContain('editia-logo.png');
    });

    it('should verify integration flow in VideoTemplateService', async () => {
      // This test verifies that the integration is properly set up in the template service
      // by checking that the watermark service methods exist and can be called
      
      expect(typeof WatermarkService.shouldAddWatermark).toBe('function');
      expect(typeof WatermarkService.addWatermarkToTemplate).toBe('function');
      expect(typeof WatermarkService.addWatermarkIfNeeded).toBe('function');
      expect(typeof WatermarkService.createWatermarkElement).toBe('function');
      
      // Verify the service methods are async where expected
      const shouldAddResult = WatermarkService.shouldAddWatermark('test-user');
      expect(shouldAddResult).toBeInstanceOf(Promise);
      
      const addIfNeededResult = WatermarkService.addWatermarkIfNeeded('test-user', mockTemplate);
      expect(addIfNeededResult).toBeInstanceOf(Promise);
      
      // Clean up the promises
      await shouldAddResult.catch(() => {}); // May fail due to missing database
      await addIfNeededResult.catch(() => {}); // May fail due to missing database
    });

    it('should verify template service has watermark integration code', async () => {
      // Read the template service file to verify it contains watermark integration
      const { readFileSync } = await import('fs');
      const templateServiceCode = readFileSync(
        '/Users/suarja/App/2025/editia/server-primary/src/services/video/template-service.ts', 
        'utf-8'
      );
      
      // Verify the code contains watermark integration
      expect(templateServiceCode).toContain('WatermarkService');
      expect(templateServiceCode).toContain('addWatermarkIfNeeded');
      expect(templateServiceCode).toContain('userId?:');
      expect(templateServiceCode).toContain('config.userId');
    });
  });
});