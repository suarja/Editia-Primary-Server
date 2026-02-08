import {
  createClerkClient,
  verifyToken,
  User as ClerkUser,
} from "@clerk/backend";
import { supabase } from "../config/supabase";
import { logger } from "../config/logger";
import { Database } from "../config/supabase-types";
import { User } from "../types/user";

export interface ClerkAuthResult {
  user: User | null;
  clerkUser: ClerkUser | null;
  errorResponse: any | null;
}

/**
 * Clerk authentication service for backend API
 */
export class ClerkAuthService {
  private static clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  /**
   * Verifies user from a Clerk JWT token and returns both Clerk user and database user
   * @param authHeader The Authorization header value containing Clerk JWT
   * @returns Object containing Clerk user, database user, or error response
   */
  static async verifyUser(
    authHeader?: string | null
  ): Promise<ClerkAuthResult> {
    logger.info(
      "🔍📈 ClerkAuthService.verifyUser called with header:",
      authHeader ? "Present" : "Missing"
    );

    // Check if auth header exists
    if (!authHeader) {
      logger.error("❌ No authorization header provided");
      return {
        user: null,
        clerkUser: null,
        errorResponse: {
          success: false,
          error: "Missing authorization header",
          status: 401,
        },
      };
    }

    // Get token from header
    const token = authHeader.replace("Bearer ", "");
    logger.info("🔍 Extracted token length:", token.length);
    logger.info("🔍 Token preview:", token.substring(0, 50) + "...");

    // Basic JWT format validation
    const jwtParts = token.split(".");
    logger.info("🔍 JWT parts count:", jwtParts.length);

    if (jwtParts.length !== 3) {
      logger.error(
        "❌ Invalid JWT format - should have 3 parts separated by dots"
      );
      return {
        user: null,
        clerkUser: null,
        errorResponse: {
          success: false,
          error:
            "Invalid JWT format - token should have 3 parts separated by dots",
          status: 401,
        },
      };
    }

    try {
      logger.info("🔍 Attempting to verify token with Clerk...");

      // Verify JWT token with Clerk using the standalone verifyToken function
      const verifiedToken = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      logger.info(
        "✅ Token verified successfully:",
        verifiedToken ? "Valid" : "Invalid"
      );

      if (!verifiedToken || !verifiedToken.sub) {
        logger.error("❌ Token verification failed - no sub claim");
        return {
          user: null,
          clerkUser: null,
          errorResponse: {
            success: false,
            error: "Invalid authentication token",
            status: 401,
          },
        };
      }

      // Get Clerk user details using the user ID from the token
      const clerkUser = await this.clerkClient.users.getUser(verifiedToken.sub);

      if (!clerkUser) {
        logger.error("❌ Clerk user not found");
        return {
          user: null,
          clerkUser: null,
          errorResponse: {
            success: false,
            error: "Clerk user not found",
            status: 401,
          },
        };
      }

      logger.info("✅ Clerk user found");

      // Get database user using Clerk user ID
      logger.info("🔍 Looking up database user");

      const { data: databaseUser, error: dbError } = await supabase
        .from("users")
        .select("*")
        .eq("clerk_user_id", clerkUser.id)
        .single();

      if (dbError || !databaseUser) {
        logger.error("❌ Database user lookup error:", dbError);
        logger.info(
          "🔍 This might mean the user needs to complete onboarding to create database record"
        );
        return {
          user: null,
          clerkUser: clerkUser,
          errorResponse: {
            success: false,
            error: "Database user not found. Please complete onboarding.",
            status: 404,
          },
        };
      }

      logger.info(
        `🔐 User verified: ${clerkUser.emailAddresses[0]?.emailAddress} (Clerk: ${clerkUser.id}, DB: ${databaseUser.id})`
      );

      // Return both Clerk user and database user
      return {
        user: databaseUser, // Database user with database ID
        clerkUser: clerkUser, // Clerk user with Clerk details
        errorResponse: null,
      };
    } catch (error: any) {
      logger.error("❌ Clerk auth service error:", error);
      logger.error("❌ Error details:", {
        name: error?.name || "Unknown",
        message: error?.message || "Unknown error",
        token: token.substring(0, 50) + "...",
      });

      return {
        user: null,
        clerkUser: null,
        errorResponse: {
          success: false,
          error:
            "Authentication service error: " +
            (error?.message || "Unknown error"),
          status: 500,
        },
      };
    }
  }

  /**
   * Helper method to get just the database user ID from a Clerk token
   * @param authHeader The Authorization header value containing Clerk JWT
   * @returns Database user ID or null
   */
  static async getDatabaseUserId(
    authHeader?: string | null
  ): Promise<string | null> {
    const { user } = await this.verifyUser(authHeader);
    return user?.id || null;
  }

  static async deleteUser(authHeader?: string | null) {
    try {
      const { user, clerkUser } = await this.verifyUser(authHeader);
      if (!user || !clerkUser) {
        return { success: false, error: "User not found" };
      }

      // ✅ NEW APPROACH: Delete from Supabase FIRST (safer order)
      // If Supabase deletion fails, nothing is deleted (safe rollback)
      // If Clerk deletion fails after Supabase, user can't login anymore (DB gone = effectively deleted)
      logger.info("🗑️ Step 1: Deleting from Supabase (with CASCADE):", user.id);
      
      const { error: dbError } = await supabase
        .from("users")
        .delete()
        .eq("id", user.id);

      if (dbError) {
        logger.error("❌ Supabase deletion failed, aborting:", dbError);
        throw new Error(`Database deletion failed: ${dbError.message}`);
      }

      logger.info("✅ Supabase deleted (CASCADE cleaned related tables)");

      // Step 2: Delete from Clerk ONLY if DB deletion succeeded
      logger.info("🗑️ Step 2: Deleting from Clerk:", clerkUser.id);
      
      try {
        await this.clerkClient.users.deleteUser(clerkUser.id);
        logger.info("✅ Clerk user deleted successfully");
      } catch (clerkError: any) {
        logger.error("❌ Clerk deletion failed BUT DB already deleted:", clerkError);
        // This is acceptable - user can't login anymore (DB is gone)
        // The orphaned Clerk user could be cleaned up manually if needed
        logger.warn("⚠️ User is effectively deleted (DB gone, Clerk orphaned)");
      }

      return { success: true, error: null };
    } catch (error: any) {
      logger.error("❌ Error deleting user:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete user"
      };
    }
  }
}
