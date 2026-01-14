import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: enhanced-comments-matching
 * Property Tests for Notification Service
 * 
 * Properties covered:
 * - Property 10: Notification Storage Completeness
 * - Property 11: Notification Ordering
 * 
 * Validates: Requirements 6.2, 6.3, 7.4
 */

// Arbitrary for generating IDs (nanoid-like)
const idArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating notification types
const notificationTypeArbitrary = fc.constantFrom('opponent_joined', 'debate_started', 'your_turn') as fc.Arbitrary<'opponent_joined' | 'debate_started' | 'your_turn'>;

// Arbitrary for generating message text
const messageArbitrary = fc.string({ minLength: 1, maxLength: 200 });

// Arbitrary for generating timestamps
const timestampArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') });

/**
 * Simulates a notification in the system
 */
interface SimulatedNotification {
  id: string;
  userId: string;
  type: 'opponent_joined' | 'debate_started' | 'your_turn';
  message: string;
  debateId: string | null;
  read: boolean;
  createdAt: Date;
}

/**
 * Simulates the notification state
 */
interface NotificationState {
  notifications: Map<string, SimulatedNotification>;
}

/**
 * Create initial empty state
 */
function createInitialState(): NotificationState {
  return {
    notifications: new Map(),
  };
}

/**
 * Create a notification
 * Per Requirements 6.2, 7.4: Store notification with all required fields
 */
function createNotification(
  state: NotificationState,
  input: {
    id: string;
    userId: string;
    type: 'opponent_joined' | 'debate_started' | 'your_turn';
    message: string;
    debateId?: string | null;
    createdAt: Date;
  }
): { state: NotificationState; notification: SimulatedNotification } {
  const notification: SimulatedNotification = {
    id: input.id,
    userId: input.userId,
    type: input.type,
    message: input.message,
    debateId: input.debateId ?? null,
    read: false,
    createdAt: input.createdAt,
  };

  const newNotifications = new Map(state.notifications);
  newNotifications.set(notification.id, notification);

  return {
    state: { notifications: newNotifications },
    notification,
  };
}

/**
 * Get notifications for a user
 * Per Requirement 6.3: Return unread first, then by createdAt descending
 */
function getUserNotifications(
  state: NotificationState,
  userId: string,
  unreadOnly: boolean = false
): SimulatedNotification[] {
  const userNotifications = Array.from(state.notifications.values())
    .filter(n => n.userId === userId)
    .filter(n => !unreadOnly || !n.read);

  // Sort: unread first, then by createdAt descending
  return userNotifications.sort((a, b) => {
    // Unread first (false < true, so unread comes first)
    if (a.read !== b.read) {
      return a.read ? 1 : -1;
    }
    // Then by createdAt descending (newest first)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Mark a notification as read
 */
function markAsRead(state: NotificationState, notificationId: string): NotificationState {
  const notification = state.notifications.get(notificationId);
  if (!notification) return state;

  const updatedNotification = { ...notification, read: true };
  const newNotifications = new Map(state.notifications);
  newNotifications.set(notificationId, updatedNotification);

  return { notifications: newNotifications };
}

/**
 * Mark all notifications as read for a user
 */
function markAllAsRead(state: NotificationState, userId: string): NotificationState {
  const newNotifications = new Map(state.notifications);
  
  for (const [id, notification] of newNotifications) {
    if (notification.userId === userId && !notification.read) {
      newNotifications.set(id, { ...notification, read: true });
    }
  }

  return { notifications: newNotifications };
}

/**
 * Get unread count for a user
 */
function getUnreadCount(state: NotificationState, userId: string): number {
  return Array.from(state.notifications.values())
    .filter(n => n.userId === userId && !n.read)
    .length;
}

describe('NotificationService Property Tests', () => {
  /**
   * Property 10: Notification Storage Completeness
   * For any notification created, it SHALL be retrievable via getUserNotifications()
   * with all fields (id, userId, type, message, read, createdAt) intact.
   * 
   * Validates: Requirements 6.2, 7.4
   */
  describe('Property 10: Notification Storage Completeness', () => {
    it('created notification should be retrievable with all fields intact', () => {
      fc.assert(
        fc.property(
          idArbitrary, // notificationId
          idArbitrary, // userId
          notificationTypeArbitrary, // type
          messageArbitrary, // message
          fc.option(idArbitrary, { nil: null }), // debateId (optional)
          timestampArbitrary, // createdAt
          (notificationId, userId, type, message, debateId, createdAt) => {
            let state = createInitialState();

            // Create notification
            const result = createNotification(state, {
              id: notificationId,
              userId,
              type,
              message,
              debateId,
              createdAt,
            });
            state = result.state;
            const created = result.notification;

            // Retrieve notifications for user
            const retrieved = getUserNotifications(state, userId);

            // Should find exactly one notification
            expect(retrieved.length).toBe(1);

            // All fields should be intact
            const found = retrieved[0];
            expect(found.id).toBe(created.id);
            expect(found.userId).toBe(created.userId);
            expect(found.type).toBe(created.type);
            expect(found.message).toBe(created.message);
            expect(found.debateId).toBe(created.debateId);
            expect(found.read).toBe(created.read);
            expect(found.createdAt.getTime()).toBe(created.createdAt.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple notifications should all be retrievable', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          fc.array(
            fc.record({
              id: idArbitrary,
              type: notificationTypeArbitrary,
              message: messageArbitrary,
              debateId: fc.option(idArbitrary, { nil: null }),
              createdAt: timestampArbitrary,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (userId, notificationInputs) => {
            // Skip if notification IDs collide
            const ids = new Set(notificationInputs.map(n => n.id));
            fc.pre(ids.size === notificationInputs.length);

            let state = createInitialState();
            const createdNotifications: SimulatedNotification[] = [];

            // Create all notifications
            for (const input of notificationInputs) {
              const result = createNotification(state, {
                id: input.id,
                userId,
                type: input.type,
                message: input.message,
                debateId: input.debateId,
                createdAt: input.createdAt,
              });
              state = result.state;
              createdNotifications.push(result.notification);
            }

            // Retrieve all notifications
            const retrieved = getUserNotifications(state, userId);

            // Should have same count
            expect(retrieved.length).toBe(createdNotifications.length);

            // All created notifications should be found
            for (const created of createdNotifications) {
              const found = retrieved.find(n => n.id === created.id);
              expect(found).toBeDefined();
              expect(found!.userId).toBe(created.userId);
              expect(found!.type).toBe(created.type);
              expect(found!.message).toBe(created.message);
              expect(found!.debateId).toBe(created.debateId);
              expect(found!.read).toBe(created.read);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('notifications for different users should be isolated', () => {
      fc.assert(
        fc.property(
          idArbitrary, // user1Id
          idArbitrary, // user2Id
          idArbitrary, // notification1Id
          idArbitrary, // notification2Id
          notificationTypeArbitrary, // type1
          notificationTypeArbitrary, // type2
          messageArbitrary, // message1
          messageArbitrary, // message2
          timestampArbitrary, // createdAt1
          timestampArbitrary, // createdAt2
          (user1Id, user2Id, notification1Id, notification2Id, type1, type2, message1, message2, createdAt1, createdAt2) => {
            // Skip if IDs collide
            fc.pre(user1Id !== user2Id);
            fc.pre(notification1Id !== notification2Id);

            let state = createInitialState();

            // Create notification for user1
            const result1 = createNotification(state, {
              id: notification1Id,
              userId: user1Id,
              type: type1,
              message: message1,
              createdAt: createdAt1,
            });
            state = result1.state;

            // Create notification for user2
            const result2 = createNotification(state, {
              id: notification2Id,
              userId: user2Id,
              type: type2,
              message: message2,
              createdAt: createdAt2,
            });
            state = result2.state;

            // User1 should only see their notification
            const user1Notifications = getUserNotifications(state, user1Id);
            expect(user1Notifications.length).toBe(1);
            expect(user1Notifications[0].id).toBe(notification1Id);

            // User2 should only see their notification
            const user2Notifications = getUserNotifications(state, user2Id);
            expect(user2Notifications.length).toBe(1);
            expect(user2Notifications[0].id).toBe(notification2Id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 11: Notification Ordering
   * For any user's notification list, unread notifications SHALL appear before read notifications,
   * and within each group, newer notifications SHALL appear first.
   * 
   * Validates: Requirements 6.3
   */
  describe('Property 11: Notification Ordering', () => {
    it('unread notifications should appear before read notifications', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          fc.array(
            fc.record({
              id: idArbitrary,
              type: notificationTypeArbitrary,
              message: messageArbitrary,
              createdAt: timestampArbitrary,
              shouldBeRead: fc.boolean(),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (userId, notificationInputs) => {
            // Skip if notification IDs collide
            const ids = new Set(notificationInputs.map(n => n.id));
            fc.pre(ids.size === notificationInputs.length);

            // Ensure we have at least one read and one unread
            const hasRead = notificationInputs.some(n => n.shouldBeRead);
            const hasUnread = notificationInputs.some(n => !n.shouldBeRead);
            fc.pre(hasRead && hasUnread);

            let state = createInitialState();

            // Create all notifications
            for (const input of notificationInputs) {
              const result = createNotification(state, {
                id: input.id,
                userId,
                type: input.type,
                message: input.message,
                createdAt: input.createdAt,
              });
              state = result.state;

              // Mark as read if needed
              if (input.shouldBeRead) {
                state = markAsRead(state, input.id);
              }
            }

            // Retrieve notifications
            const retrieved = getUserNotifications(state, userId);

            // Verify ordering: all unread should come before all read
            let seenRead = false;
            for (const notification of retrieved) {
              if (notification.read) {
                seenRead = true;
              } else {
                // If we've seen a read notification, we shouldn't see unread after
                expect(seenRead).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('within unread group, newer notifications should appear first', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          fc.array(
            fc.record({
              id: idArbitrary,
              type: notificationTypeArbitrary,
              message: messageArbitrary,
              createdAt: timestampArbitrary,
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (userId, notificationInputs) => {
            // Skip if notification IDs collide
            const ids = new Set(notificationInputs.map(n => n.id));
            fc.pre(ids.size === notificationInputs.length);

            let state = createInitialState();

            // Create all notifications (all unread)
            for (const input of notificationInputs) {
              const result = createNotification(state, {
                id: input.id,
                userId,
                type: input.type,
                message: input.message,
                createdAt: input.createdAt,
              });
              state = result.state;
            }

            // Retrieve notifications
            const retrieved = getUserNotifications(state, userId);

            // Verify ordering: newer should come first (descending by createdAt)
            for (let i = 1; i < retrieved.length; i++) {
              expect(retrieved[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
                retrieved[i].createdAt.getTime()
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('within read group, newer notifications should appear first', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          fc.array(
            fc.record({
              id: idArbitrary,
              type: notificationTypeArbitrary,
              message: messageArbitrary,
              createdAt: timestampArbitrary,
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (userId, notificationInputs) => {
            // Skip if notification IDs collide
            const ids = new Set(notificationInputs.map(n => n.id));
            fc.pre(ids.size === notificationInputs.length);

            let state = createInitialState();

            // Create all notifications and mark them as read
            for (const input of notificationInputs) {
              const result = createNotification(state, {
                id: input.id,
                userId,
                type: input.type,
                message: input.message,
                createdAt: input.createdAt,
              });
              state = result.state;
              state = markAsRead(state, input.id);
            }

            // Retrieve notifications
            const retrieved = getUserNotifications(state, userId);

            // All should be read
            expect(retrieved.every(n => n.read)).toBe(true);

            // Verify ordering: newer should come first (descending by createdAt)
            for (let i = 1; i < retrieved.length; i++) {
              expect(retrieved[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
                retrieved[i].createdAt.getTime()
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('unreadOnly filter should only return unread notifications', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          fc.array(
            fc.record({
              id: idArbitrary,
              type: notificationTypeArbitrary,
              message: messageArbitrary,
              createdAt: timestampArbitrary,
              shouldBeRead: fc.boolean(),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (userId, notificationInputs) => {
            // Skip if notification IDs collide
            const ids = new Set(notificationInputs.map(n => n.id));
            fc.pre(ids.size === notificationInputs.length);

            let state = createInitialState();

            // Create all notifications
            for (const input of notificationInputs) {
              const result = createNotification(state, {
                id: input.id,
                userId,
                type: input.type,
                message: input.message,
                createdAt: input.createdAt,
              });
              state = result.state;

              // Mark as read if needed
              if (input.shouldBeRead) {
                state = markAsRead(state, input.id);
              }
            }

            // Retrieve only unread notifications
            const unreadOnly = getUserNotifications(state, userId, true);

            // All returned should be unread
            expect(unreadOnly.every(n => !n.read)).toBe(true);

            // Count should match expected unread count
            const expectedUnreadCount = notificationInputs.filter(n => !n.shouldBeRead).length;
            expect(unreadOnly.length).toBe(expectedUnreadCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('markAllAsRead should mark all user notifications as read', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          fc.array(
            fc.record({
              id: idArbitrary,
              type: notificationTypeArbitrary,
              message: messageArbitrary,
              createdAt: timestampArbitrary,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (userId, notificationInputs) => {
            // Skip if notification IDs collide
            const ids = new Set(notificationInputs.map(n => n.id));
            fc.pre(ids.size === notificationInputs.length);

            let state = createInitialState();

            // Create all notifications (all unread initially)
            for (const input of notificationInputs) {
              const result = createNotification(state, {
                id: input.id,
                userId,
                type: input.type,
                message: input.message,
                createdAt: input.createdAt,
              });
              state = result.state;
            }

            // Verify all are unread
            expect(getUnreadCount(state, userId)).toBe(notificationInputs.length);

            // Mark all as read
            state = markAllAsRead(state, userId);

            // Verify all are now read
            expect(getUnreadCount(state, userId)).toBe(0);

            // All notifications should still be retrievable
            const retrieved = getUserNotifications(state, userId);
            expect(retrieved.length).toBe(notificationInputs.length);
            expect(retrieved.every(n => n.read)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getUnreadCount should return correct count', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          fc.array(
            fc.record({
              id: idArbitrary,
              type: notificationTypeArbitrary,
              message: messageArbitrary,
              createdAt: timestampArbitrary,
              shouldBeRead: fc.boolean(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (userId, notificationInputs) => {
            // Skip if notification IDs collide
            const ids = new Set(notificationInputs.map(n => n.id));
            fc.pre(ids.size === notificationInputs.length);

            let state = createInitialState();

            // Create all notifications
            for (const input of notificationInputs) {
              const result = createNotification(state, {
                id: input.id,
                userId,
                type: input.type,
                message: input.message,
                createdAt: input.createdAt,
              });
              state = result.state;

              // Mark as read if needed
              if (input.shouldBeRead) {
                state = markAsRead(state, input.id);
              }
            }

            // Get unread count
            const unreadCount = getUnreadCount(state, userId);

            // Should match expected count
            const expectedUnreadCount = notificationInputs.filter(n => !n.shouldBeRead).length;
            expect(unreadCount).toBe(expectedUnreadCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
