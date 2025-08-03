import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoValidationService } from '../validation-service';
import { VideoType } from '../../../types/video';
import validVideos from './fixtures/videos.json';
import voiceIdTemplate from '../../__tests__/templates/voiceId-template.json';
import { CaptionPlacement, HexColor, TranscriptEffect } from 'editia-core';

// Mock dependencies
vi.mock('../../../config/logger', () => ({
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

vi.mock('../videoUrlRepairer', () => ({
  VideoUrlRepairer: vi.fn().mockImplementation(() => ({
    repairTemplate: vi.fn(),
    validateScenePlan: vi.fn((scenePlan) => scenePlan),
  })),
}));

vi.mock('../../../config/openai', () => ({
  createOpenAIClient: vi.fn(() => ({
    responses: {
      parse: vi.fn(),
    },
  })),
  MODELS: {
    '4.1': 'gpt-4',
  },
}));

vi.mock('../../../utils/video/preset-converter', () => ({
  convertCaptionConfigToProperties: vi.fn((config) => ({
    transcript_color: config.transcriptColor || '#ffffff',
    transcript_effect: config.transcriptEffect || 'highlight',
    y_alignment: '90%',
    font_size: '8 vmin',
    font_family: 'Montserrat',
    font_weight: '700',
  })),
}));

describe('VideoValidationService', () => {
  let service: VideoValidationService;
  let mockLogger: any;
  
  beforeEach(() => {
    service = new VideoValidationService();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe('validateTemplate', () => {
    const mockConfig = {
      scriptText: 'Test script',
      selectedVideos: validVideos as VideoType[],
      captionConfig: { enabled: true, placement: 'bottom' as CaptionPlacement, transcriptColor: '#ffffff' as HexColor, transcriptEffect: 'karaoke' as TranscriptEffect },
      editorialProfile: {},
      voiceId: 'test-voice-id',
      outputLanguage: 'en',
      captionStructure: {
        enabled: true,
        presetId: 'karaoke',
        placement: 'bottom',
        transcriptColor: '#ffffff',
        transcriptEffect: 'karaoke',
      },
    };

    it('should validate template structure successfully', async () => {
      const validTemplate = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [],
      };

      const result = await service.validateTemplate(validTemplate, mockConfig);
      
      expect(result).toBeDefined();
      expect(result.output_format).toBe('mp4');
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1920);
    });

    it('should throw error for missing required template properties', async () => {
      const invalidTemplate = {
        width: 1080,
        height: 1920,
        // missing output_format and elements
      };

      await expect(
        service.validateTemplate(invalidTemplate, mockConfig)
      ).rejects.toThrow('Cannot read properties of undefined');
    });

    it('should throw error for incorrect dimensions', async () => {
      const wrongDimensionsTemplate = {
        output_format: 'mp4',
        width: 1920, // wrong
        height: 1080, // wrong
        elements: [],
      };

      await expect(
        service.validateTemplate(wrongDimensionsTemplate, mockConfig)
      ).rejects.toThrow('Invalid template: Must be 1080x1920 for vertical video');
    });

    it('should throw error when elements is not an array', async () => {
      const invalidElementsTemplate = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: 'not-an-array',
      };

      await expect(
        service.validateTemplate(invalidElementsTemplate, mockConfig)
      ).rejects.toThrow('template.elements.forEach is not a function');
    });

    it('should apply audio text to source patch', async () => {
      const templateWithTextAudio = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [
          {
            type: 'composition',
            elements: [
              {
                type: 'audio',
                id: 'audio-1',
                text: 'This should become source', // wrong property
              },
            ],
          },
        ],
      };

      const result = await service.validateTemplate(templateWithTextAudio, mockConfig);
      
      expect(result.elements[0].elements[0].source).toBe('This should become source');
      expect(result.elements[0].elements[0].text).toBeUndefined();
    });

    it('should fix video elements to have fit=cover and duration=null', async () => {
      const templateWithVideo = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [
          {
            type: 'composition',
            elements: [
              {
                type: 'video',
                fit: 'contain', // should be changed to 'cover'
                duration: 10, // should be changed to null
                volume: 50, // should be changed to 0
              },
            ],
          },
        ],
      };

      const result = await service.validateTemplate(templateWithVideo, mockConfig);
      
      const videoElement = result.elements[0].elements[0];
      expect(videoElement.fit).toBe('cover');
      expect(videoElement.duration).toBeNull();
      expect(videoElement.volume).toBe(0);
      expect(videoElement.time).toBe(0); // First video should have time: 0
    });

    it('should apply time strategy: first video time=0, others time="auto"', async () => {
      const templateWithMultipleVideos = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [
          {
            type: 'composition',
            elements: [
              {
                type: 'video',
                id: 'video-1',
                time: 5, // Should be fixed to 0
              },
              {
                type: 'video', 
                id: 'video-2',
                time: 10, // Should be fixed to "auto"
              },
              {
                type: 'video',
                id: 'video-3', 
                time: 15, // Should be fixed to "auto"
              },
              {
                type: 'audio', // Should be ignored
                id: 'audio-1',
              },
            ],
          },
        ],
      };

      const result = await service.validateTemplate(templateWithMultipleVideos, mockConfig);
      
      const elements = result.elements[0].elements;
      const videoElements = elements.filter((el: any) => el.type === 'video');
      
      expect(videoElements[0].time).toBe(0);
      expect(videoElements[1].time).toBe("auto");
      expect(videoElements[2].time).toBe("auto");
      
      // All videos should have standardized properties
      videoElements.forEach((video: any) => {
        expect(video.duration).toBeNull();
        expect(video.fit).toBe('cover');
        expect(video.volume).toBe(0);
      });
    });

    it('should handle caption configuration', async () => {
      const templateWithCaptions = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [
          {
            type: 'composition',
            elements: [
              {
                type: 'text',
                name: 'subtitle-1',
                transcript_source: 'audio-1',
              },
            ],
          },
        ],
      };

      const result = await service.validateTemplate(templateWithCaptions, mockConfig);
      
      const subtitle = result.elements[0].elements[0];
      expect(subtitle.transcript_color).toBe('#ffffff');
      expect(subtitle.transcript_effect).toBe('karaoke');
    });

    it('should remove captions when disabled', async () => {
      const templateWithCaptions = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [
          {
            type: 'composition',
            elements: [
              {
                type: 'text',
                name: 'subtitle-1',
              },
              {
                type: 'video',
                source: 'test.mp4',
              },
            ],
          },
        ],
      };

      const configWithDisabledCaptions = {
        ...mockConfig,
        captionStructure: { enabled: false },
      };

      const result = await service.validateTemplate(templateWithCaptions, configWithDisabledCaptions);
      
      // Should only have video element left
      expect(result.elements[0].elements).toHaveLength(1);
      expect(result.elements[0].elements[0].type).toBe('video');
    });
  });

  describe('validateTemplateVoiceIds', () => {
    const mockConfig = {
      scriptText: 'Test script',
      selectedVideos: validVideos as VideoType[],
      captionConfig: { enabled: true, placement: 'bottom' as CaptionPlacement, transcriptColor: '#ffffff' as HexColor, transcriptEffect: 'karaoke' as TranscriptEffect },
      editorialProfile: {},
      voiceId: 'correct-voice-id',
      outputLanguage: 'en',
    };

    it('should fix mismatched voice IDs', async () => {
      const templateWithWrongVoiceId = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [
          {
            type: 'composition',
            elements: [
              {
                type: 'audio',
                id: 'voice-scene-1',
                provider: 'elevenlabs model_id=eleven_multilingual_v2 voice_id=wrong-voice-id',
              },
            ],
          },
        ],
      };

      const result = await service.validateTemplate(templateWithWrongVoiceId, mockConfig);
      
      const audioElement = result.elements[0].elements[0];
      expect(audioElement.provider).toContain('voice_id=correct-voice-id');
      expect(audioElement.provider).not.toContain('voice_id=wrong-voice-id');
    });

    it('should add voice ID when missing from provider string', async () => {
      const templateMissingVoiceId = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [
          {
            type: 'composition',
            elements: [
              {
                type: 'audio',
                id: 'voice-scene-1',
                provider: 'elevenlabs model_id=eleven_multilingual_v2', // missing voice_id
              },
            ],
          },
        ],
      };

      const result = await service.validateTemplate(templateMissingVoiceId, mockConfig);
      
      const audioElement = result.elements[0].elements[0];
      expect(audioElement.provider).toContain('voice_id=correct-voice-id');
    });

    it('should create provider string when completely missing', async () => {
      const templateNoProvider = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [
          {
            type: 'composition',
            elements: [
              {
                type: 'audio',
                id: 'voice-scene-1',
                // no provider property
              },
            ],
          },
        ],
      };

      const result = await service.validateTemplate(templateNoProvider, mockConfig);
      
      const audioElement = result.elements[0].elements[0];
      expect(audioElement.provider).toBe('elevenlabs model_id=eleven_multilingual_v2 voice_id=correct-voice-id');
    });

    it('should fix voice IDs across multiple scenes', async () => {
      const multiSceneTemplate = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [
          {
            type: 'composition',
            elements: [
              {
                type: 'audio',
                id: 'voice-scene-1',
                provider: 'elevenlabs model_id=eleven_multilingual_v2 voice_id=wrong-id-1',
              },
            ],
          },
          {
            type: 'composition',
            elements: [
              {
                type: 'audio',
                id: 'voice-scene-2',
                provider: 'elevenlabs model_id=eleven_multilingual_v2 voice_id=wrong-id-2',
              },
            ],
          },
        ],
      };

      const result = await service.validateTemplate(multiSceneTemplate, mockConfig);
      
      result.elements.forEach((scene: any) => {
        const audioElement = scene.elements.find((el: any) => el.type === 'audio');
        if (audioElement) {
          expect(audioElement.provider).toContain('voice_id=correct-voice-id');
        }
      });
    });

    it('should not modify non-audio elements', async () => {
      const mixedElementsTemplate = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [
          {
            type: 'composition',
            elements: [
              {
                type: 'video',
                source: 'test.mp4',
              },
              {
                type: 'audio',
                id: 'voice-scene-1',
                provider: 'elevenlabs model_id=eleven_multilingual_v2 voice_id=wrong-voice-id',
              },
              {
                type: 'text',
                name: 'subtitle',
              },
            ],
          },
        ],
      };

      const result = await service.validateTemplate(mixedElementsTemplate, mockConfig);
      
      const videoElement = result.elements[0].elements.find((el: any) => el.type === 'video');
      const textElement = result.elements[0].elements.find((el: any) => el.type === 'text');
      
      expect(videoElement.provider).toBeUndefined();
      expect(textElement.provider).toBeUndefined();
    });

    it('should skip voice ID validation when no voiceId provided in config', async () => {
      const templateWithVoiceId = {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        elements: [
          {
            type: 'composition',
            elements: [
              {
                type: 'audio',
                id: 'voice-scene-1',
                provider: 'elevenlabs model_id=eleven_multilingual_v2 voice_id=original-voice-id',
              },
            ],
          },
        ],
      };

      const configWithoutVoiceId = {
        ...mockConfig,
        voiceId: '',
      };

      const result = await service.validateTemplate(templateWithVoiceId, configWithoutVoiceId);
      
      const audioElement = result.elements[0].elements[0];
      expect(audioElement.provider).toContain('voice_id=original-voice-id'); // unchanged
    });
  });

  describe('validateSceneDurations', () => {
    it('should detect duration violations when text is too long for video', () => {
      const scenePlan = {
        scenes: [
          {
            scene_number: 1,
            script_text: 'This is a very long text that will take more than 10 seconds to read', // 15 words * 0.5 = 7.5s
            video_asset: {
              id: 'video-1',
              trim_start: null,
              trim_duration: '6', // 6 seconds available
            },
          },
        ],
      };

      const selectedVideos = [
        {
          id: 'video-1',
          duration_seconds: 10,
        },
      ];

      // Access private method through reflection for testing
      const violations = (service as any).validateSceneDurations(scenePlan, selectedVideos);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].sceneIndex).toBe(0);
      expect(violations[0].textLength).toBeCloseTo(7.5, 1);
      expect(violations[0].videoLength).toBe(6);
    });

    it('should pass validation when text fits within video duration', () => {
      const scenePlan = {
        scenes: [
          {
            scene_number: 1,
            script_text: 'Short text', // 2 words * 0.5 = 1.0s
            video_asset: {
              id: 'video-1',
              trim_start: null,
              trim_duration: '5', // 5 seconds available
            },
          },
        ],
      };

      const selectedVideos = [
        {
          id: 'video-1',
          duration_seconds: 10,
        },
      ];

      const violations = (service as any).validateSceneDurations(scenePlan, selectedVideos);
      
      expect(violations).toHaveLength(0);
    });

    it('should use full video duration when trim_duration is not provided', () => {
      const scenePlan = {
        scenes: [
          {
            scene_number: 1,
            script_text: 'This is a medium length text for testing', // 8 words * 0.5 = 4.0s
            video_asset: {
              id: 'video-2',
              trim_start: null,
              trim_duration: null, // No trim, use full duration
            },
          },
        ],
      };

      const selectedVideos = [
        {
          id: 'video-2',
          duration_seconds: 3, // Only 3 seconds available
        },
      ];

      const violations = (service as any).validateSceneDurations(scenePlan, selectedVideos);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].videoLength).toBe(3);
    });

    it('should apply 95% safety margin to video duration', () => {
      const scenePlan = {
        scenes: [
          {
            scene_number: 1,
            script_text: 'Text that is exactly at the limit', // 7 words * 0.5 = 3.5s
            video_asset: {
              id: 'video-1',
              trim_start: null,
              trim_duration: '3', // 3 * 0.95 = 2.85s max allowed
            },
          },
        ],
      };

      const violations = (service as any).validateSceneDurations(scenePlan, []);
      
      expect(violations).toHaveLength(1); // 3.5s > 2.85s
      expect(violations[0].overageSeconds).toBeCloseTo(0.65, 1);
    });

    it('should handle multiple scenes with mixed violations', () => {
      const scenePlan = {
        scenes: [
          {
            scene_number: 1,
            script_text: 'Short OK text', // 3 words * 0.5 = 1.5s
            video_asset: {
              id: 'video-1',
              trim_duration: '5', // OK
            },
          },
          {
            scene_number: 2,
            script_text: 'This is a very long text that will definitely exceed the duration', // 12 words * 0.5 = 6.0s
            video_asset: {
              id: 'video-2',
              trim_duration: '4', // Too short
            },
          },
          {
            scene_number: 3,
            script_text: 'Another OK text', // 3 words * 0.5 = 1.5s
            video_asset: {
              id: 'video-3',
              trim_duration: '4', // OK
            },
          },
        ],
      };

      const violations = (service as any).validateSceneDurations(scenePlan, []);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].sceneIndex).toBe(1); // Second scene
    });

    it('should skip validation for scenes with invalid or missing video duration', () => {
      const scenePlan = {
        scenes: [
          {
            scene_number: 1,
            script_text: 'Text with no video duration info',
            video_asset: {
              id: 'video-missing',
              trim_duration: '0', // Invalid duration
            },
          },
          {
            scene_number: 2,
            script_text: 'Text with negative duration',
            video_asset: {
              id: 'video-negative',
              trim_duration: '-5', // Invalid
            },
          },
        ],
      };

      const violations = (service as any).validateSceneDurations(scenePlan, []);
      
      expect(violations).toHaveLength(0); // Both skipped
    });

    it('should calculate word count correctly ignoring empty strings', () => {
      const scenePlan = {
        scenes: [
          {
            scene_number: 1,
            script_text: '  Word   count    test   ', // 3 words despite extra spaces
            video_asset: {
              id: 'video-1',
              trim_duration: '1', // 3 * 0.5 = 1.5s > 1 * 0.95 = 0.95s
            },
          },
        ],
      };

      const violations = (service as any).validateSceneDurations(scenePlan, []);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].textLength).toBeCloseTo(1.5, 1);
    });
  });

  describe('applySimplifiedVideoStrategy', () => {
    it('should remove trim_start and trim_duration from scene assets', () => {
      const scenePlan = {
        scenes: [
          {
            scene_number: 1,
            script_text: 'Test scene',
            video_asset: {
              id: 'video-1',
              trim_start: '5',
              trim_duration: '10',
              url: 'https://example.com/video1.mp4'
            },
          },
          {
            scene_number: 2,
            script_text: 'Another test scene',
            video_asset: {
              id: 'video-2',
              trim_start: '0',
              trim_duration: '8',
              url: 'https://example.com/video2.mp4'
            },
          },
        ],
      };

      // Apply the simplified strategy
      (service as any).applySimplifiedVideoStrategy(scenePlan, mockLogger);

      // Check that trim properties were removed
      expect(scenePlan.scenes[0].video_asset.trim_start).toBeUndefined();
      expect(scenePlan.scenes[0].video_asset.trim_duration).toBeUndefined();
      expect(scenePlan.scenes[1].video_asset.trim_start).toBeUndefined();
      expect(scenePlan.scenes[1].video_asset.trim_duration).toBeUndefined();

      // Check that other properties remain
      expect(scenePlan.scenes[0].video_asset.id).toBe('video-1');
      expect(scenePlan.scenes[0].video_asset.url).toBe('https://example.com/video1.mp4');
    });

    it('should handle scenes without video assets gracefully', () => {
      const scenePlan = {
        scenes: [
          {
            scene_number: 1,
            script_text: 'Test scene',
            video_asset: null,
          },
          {
            scene_number: 2,
            script_text: 'Another scene',
            // Missing video_asset
          },
        ],
      };

      // Should not throw error
      expect(() => {
        (service as any).applySimplifiedVideoStrategy(scenePlan, mockLogger);
      }).not.toThrow();
    });

    it('should handle scenes where trim properties are already undefined', () => {
      const scenePlan = {
        scenes: [
          {
            scene_number: 1,
            script_text: 'Test scene',
            video_asset: {
              id: 'video-1',
              url: 'https://example.com/video1.mp4'
              // No trim properties
            },
          },
        ],
      };

      // Should not throw error
      expect(() => {
        (service as any).applySimplifiedVideoStrategy(scenePlan, mockLogger);
      }).not.toThrow();

      // Properties should still be undefined
      expect(scenePlan.scenes[0].video_asset.trim_start).toBeUndefined();
      expect(scenePlan.scenes[0].video_asset.trim_duration).toBeUndefined();
    });
  });
});