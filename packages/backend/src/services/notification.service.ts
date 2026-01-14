import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, notifications, users } from '../db';
import { broadcastNotification, isUserConnected } from '../broadcast';
import type { 
  Notification, 
  CreateNotificationInput,
  NotificationType
} from '@debate-platform/shared';

/**
 * NotificationService handles user notifications for debate events.
 * 
 * Per Requirements 6.1, 6.2, 6.3, 6.4, 6.5:
 * - Create notifications when opponent joins debate
 * - Store notifications with user ID, type, message, and read status
 * - Return unread notifications first, then by creation time
 * - Support marking notifications as read
 * - Support notification types: opponent_joined, debate_started, your_turn
 * 
 * Per Requirements 7.1, 7.4:
 * - Broadcast notification to user if connected
 * - Store notification for later retrieval if user not connected
 */
export class NotificationService {
  /**
   * Create a notification for a user
   * Per Requirements 6.1, 6.2, 7.1, 7.4:
   * - Store notification with all required fields
   * - Broadcast to user if connected
   * - Store for later retrieval if not connected
   * 
   * @param input - The notification input
   * @returns Created notification
   * @throws Error if user not found
   */
  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
    });

    if (!user) {
      throw new Error('User not found');
    }

    const id = nanoid();
    const createdAt = new Date();

    // Store the notification
    const [notification] = await db.insert(notifications).values({
      id,
      userId: input.userId,
      type: input.type,
      message: input.message,
      debateId: input.debateId ?? null,
      read: false,
      createdAt,
    }).returning();

    const mappedNotification = this.mapToNotification(notification);

    // Broadcast to user if connected (Requirement 7.1)
    // If not connected, notification is stored for later retrieval (Requirement 7.4)
    if (isUserConnected(input.userId)) {
      broadcastNotification(input.userId, {
        id: mappedNotification.id,
        type: mappedNotification.type,
        message: mappedNotification.message,
        debateId: mappedNotification.debateId ?? undefined,
        createdAt: mappedNotification.createdAt.toISOString(),
      });
    }

    return mappedNotification;
  }

  /**
   * Get notifications for a user
   * Per Requirement 6.3: Return unread notifications first, then by creation time descending
   * 
   * @param userId - The user ID
   * @param unreadOnly - If true, only return unread notifications
   * @returns Array of notifications
   */
  async getUserNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
    // Build query conditions
    const conditions = unreadOnly 
      ? and(eq(notifications.userId, userId), eq(notifications.read, false))
      : eq(notifications.userId, userId);

    // Fetch notifications ordered by: unread first, then by createdAt descending
    // We use a raw SQL order to get unread first (read=false before read=true)
    const userNotifications = await db.query.notifications.findMany({
      where: conditions,
      orderBy: [
        // Unread first (false < true in boolean ordering, so we use desc to get false first)
        desc(sql`CASE WHEN ${notifications.read} = false THEN 0 ELSE 1 END`),
        // Then by creation time descending (newest first)
        desc(notifications.createdAt),
      ],
    });

    return userNotifications.map((n: typeof notifications.$inferSelect) => this.mapToNotification(n));
  }

  /**
   * Mark a notification as read
   * Per Requirement 6.4: Update read status
   * 
   * @param notificationId - The notification ID
   * @returns True if updated, false if not found
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.read, false)
      ))
      .returning();

    return result.length > 0;
  }

  /**
   * Mark all notifications as read for a user
   * Per Requirement 6.4: Update read status
   * 
   * @param userId - The user ID
   * @returns Number of notifications marked as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await db.update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      ))
      .returning();

    return result.length;
  }

  /**
   * Get the count of unread notifications for a user
   * Per Requirement 6.3: Support getting unread count
   * 
   * @param userId - The user ID
   * @returns Number of unread notifications
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      ));

    return result[0]?.count ?? 0;
  }

  /**
   * Map database row to Notification type
   */
  private mapToNotification(row: typeof notifications.$inferSelect): Notification {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type as NotificationType,
      message: row.message,
      debateId: row.debateId,
      read: row.read,
      createdAt: row.createdAt,
    };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
