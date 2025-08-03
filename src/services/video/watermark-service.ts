import { supabase } from "../../config/supabase";
import { logger } from "../../config/logger";
import { SupabaseClient } from "@supabase/supabase-js";


export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Service for managing watermarks on generated videos
 * Adds Editia watermark for free users based on their subscription plan
 */
export class WatermarkService {
  private static readonly WATERMARK_IMAGE_URL = 'https://ai-edit-v1.s3.us-east-1.amazonaws.com/cdn/images/editia-logo.png';
  
  private db: SupabaseClient;
  private log: Logger;

  constructor(db: SupabaseClient = supabase, log: Logger = logger) {
    this.db = db;
    this.log = log;
  }

  /**
   * Determines if a user should have a watermark added to their videos
   * Based on their current subscription plan in user_usage table
   */
  async shouldAddWatermark(userId: string): Promise<boolean> {
    try {
      this.log.info(`🔍 Checking watermark requirement for user ${userId}`);
      
      const { data: userUsage, error } = await this.db
        .from("user_usage")
        .select("current_plan_id")
        .eq("user_id", userId)
        .single();

      if (error) {
        this.log.error(`❌ Error fetching user usage for ${userId}:`, error);
        // Fail-safe: add watermark if we can't determine plan
        this.log.warn(`⚠️ Adding watermark as fail-safe for user ${userId}`);
        return true;
      }

      if (!userUsage) {
        this.log.warn(`⚠️ No usage data found for user ${userId}, adding watermark as fail-safe`);
        return true;
      }

      // Check if user is on free plan
      const isFreePlan = this.isFreePlan(userUsage.current_plan_id);
      
      this.log.info(`✅ User ${userId} plan check: ${userUsage.current_plan_id} -> watermark: ${isFreePlan}`);
      
      return isFreePlan;
    } catch (error) {
      this.log.error(`❌ Unexpected error checking watermark for user ${userId}:`, error);
      // Fail-safe: add watermark on any error
      return true;
    }
  }

  /**
   * Determines if a plan ID indicates a free plan that requires watermarks
   */
  private isFreePlan(planId: string): boolean {
    if (!planId) {
      return true; // No plan = free plan
    }
    
    // Convert to lowercase for case-insensitive comparison
    const plan = planId.toLowerCase();
    
    // Check for common free plan indicators
    const freePlanIndicators = ['free', 'trial', 'basic', 'starter'];
    
    return freePlanIndicators.some(indicator => plan.includes(indicator));
  }

  /**
   * Creates a Creatomate watermark element configuration
   */
  createWatermarkElement(): object {
    this.log.info(`🎨 Creating watermark element with image: ${WatermarkService.WATERMARK_IMAGE_URL}`);
    
    return {
      type: "image",
      track: 4, // Above video (1), text (2), and audio (3)
      source: WatermarkService.WATERMARK_IMAGE_URL,
      fit: "contain",
      width: "20 vmin", // Responsive size that adapts to video resolution
      height: "20 vmin",
      x: "100%", // Position at right edge
      y: "100%", // Position at bottom edge
      xAnchor: "100%", // Anchor to right edge of element
      yAnchor: "100%", // Anchor to bottom edge of element
      xAlignment: "100%", // Align to right within container
      yAlignment: "100%", // Align to bottom within container
      xPadding: "4 vmin", // Padding from right edge
      yPadding: "4 vmin", // Padding from bottom edge
      opacity: 0.8, // Semi-transparent
      time: 0, // Start immediately
      duration: null, // Last for entire scene duration
    };
  }

  /**
   * Adds watermark elements to all scene compositions in a Creatomate template
   */
  addWatermarkToTemplate(template: any): void {
    this.log.info(`🖼️ Adding watermark to template with ${template.elements?.length || 0} scenes`);
    
    if (!template.elements || !Array.isArray(template.elements)) {
      this.log.warn(`⚠️ Template has no elements array, cannot add watermark`);
      return;
    }

    let watermarksAdded = 0;
    
    template.elements.forEach((composition: any, index: number) => {
      if (composition.type === 'composition' && composition.elements) {
        // Add watermark element to this scene
        const watermarkElement = this.createWatermarkElement();
        composition.elements.push(watermarkElement);
        watermarksAdded++;
        
        this.log.info(`✅ Added watermark to scene ${index + 1}`);
      }
    });
    
    this.log.info(`🎯 Successfully added watermark to ${watermarksAdded} scenes`);
  }

  /**
   * Convenience method that checks if user needs watermark and adds it if needed
   */
  async addWatermarkIfNeeded(userId: string, template: any): Promise<boolean> {
    const needsWatermark = await this.shouldAddWatermark(userId);
    
    if (needsWatermark) {
      this.addWatermarkToTemplate(template);
      this.log.info(`🏷️ Watermark added for free user ${userId}`);
      return true;
    } else {
      this.log.info(`💎 No watermark needed for paid user ${userId}`);
      return false;
    }
  }

  // Static convenience methods for backward compatibility
  static async shouldAddWatermark(userId: string): Promise<boolean> {
    const service = new WatermarkService();
    return service.shouldAddWatermark(userId);
  }

  static createWatermarkElement(): object {
    const service = new WatermarkService();
    return service.createWatermarkElement();
  }

  static addWatermarkToTemplate(template: any): void {
    const service = new WatermarkService();
    service.addWatermarkToTemplate(template);
  }

  static async addWatermarkIfNeeded(userId: string, template: any): Promise<boolean> {
    const service = new WatermarkService();
    return service.addWatermarkIfNeeded(userId, template);
  }
}

// Export singleton instance for convenience
export const watermarkService = new WatermarkService();