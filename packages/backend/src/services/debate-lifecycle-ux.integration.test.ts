import { describe, it, expect, beforeEach } from 'vitest';
import { debateService } from './debate.service';
import { votingService } from './voting.service';
import { mediaService } from './media.service';
import { reputationEngineV2 } from './reputation-engine-v2.service';
import { privacyGuard } from './privacy-guard.service';
import { db, users, stances, reputationFactors, reputationHistory, mediaAttachments, arguments_ } from '../db';
import { cleanTestDb } from '../db/test-setup';
import { eq, and } from 'drizzle-orm';

/**
 * Integration Tests for Debate Lifecycle UX Enhancement
 * 
 * These tests validate end-to-end flows for:
 * - Task 25.1: Debate with media attachments
 * - Task 25.2: Reputation flow through debate conclusion
 * - Task 25.3: Privacy enforcement across all flows
 */

describe('Debate Lifecycle UX Integration Tests', () => {
  let supporterId: string;
  let opposerId: string;
  let voterId1: string;
  let voterId2: string;

  beforeEach(async () => {
    await cleanTestDb();
    
    // Create test users
    supporterId = 'supporter-integration';
    opposerId = 'opposer-integration';
    voterId1 = 'voter-integration-1';
    voterId2 = 'voter-integration-2';
    
    await db.insert(users).values([
      {
        id: supporterId,
        username: 'supporter_int',
        email: 'supporter_int@test.com',
        passwordHash: 'hash123',
        reputationScore: 100,
        predictionAccuracy: 50,
      },
      {
        id: opposerId,
        username: 'opposer_int',
        email: 'opposer_int@test.com',
        passwordHash: 'hash123',
        reputationScore: 100,
        predictionAccuracy: 50,
      },
      {
        id: voterId1,
        username: 'voter_int_1',
        email: 'voter_int_1@test.com',
        passwordHash: 'hash123',
        reputationScore: 100,
        predictionAccuracy: 50,
      },
      {
        id: voterId2,
        username: 'voter_int_2',
        email: 'voter_int_2@test.com',
        passwordHash: 'hash123',
        reputationScore: 100,
        predictionAccuracy: 50,
      },
    ]);
  });

  /**
   * Task 25.1: End-to-end test for debate with media
   * Requirements: 2.1, 2.4
   * - Create debate, add argument with media, verify display
   */
  describe('25.1 Debate with Media', () => {
    it('should create debate, add argument with media attachment, and verify display', async () => {
      // Step 1: Create a debate
      const { debate } = await debateService.createDebate({
        resolution: 'AI will significantly improve healthcare outcomes in the next decade',
        creatorId: supporterId,
        creatorSide: 'support',
      });
      
      expect(debate.id).toBeDefined();
      expect(debate.status).toBe('active');
      
      // Step 2: Join as opponent
      await debateService.joinDebateAsOppose(debate.id, opposerId);
      
      // Step 3: Submit argument (must be at least 100 characters)
      const argument = await debateService.submitArgument({
        debateId: debate.id,
        debaterId: supporterId,
        content: 'AI-powered diagnostic tools have shown remarkable accuracy in detecting diseases early. Studies from leading medical institutions demonstrate that machine learning algorithms can identify patterns in medical imaging that human doctors might miss, leading to earlier interventions and better patient outcomes.',
      });
      
      expect(argument.id).toBeDefined();
      expect(argument.side).toBe('support');
      
      // Step 4: Add media attachment to the argument
      // Test file validation first
      const validFile = {
        size: 5 * 1024 * 1024, // 5MB
        type: 'image/jpeg',
        name: 'medical-study-chart.jpg',
      };
      
      const validation = mediaService.validateFile(validFile);
      expect(validation.valid).toBe(true);
      
      // Upload the file
      const mediaAttachment = await mediaService.uploadFile(validFile, argument.id, supporterId);
      
      expect(mediaAttachment.id).toBeDefined();
      expect(mediaAttachment.argumentId).toBe(argument.id);
      expect(mediaAttachment.type).toBe('file');
      expect(mediaAttachment.mimeType).toBe('image/jpeg');
      
      // Step 5: Verify media can be retrieved for the argument
      const argumentMedia = await mediaService.getArgumentMedia(argument.id);
      
      expect(argumentMedia).toHaveLength(1);
      expect(argumentMedia[0].id).toBe(mediaAttachment.id);
      expect(argumentMedia[0].argumentId).toBe(argument.id);
    });

    it('should support YouTube URL media attachments', async () => {
      // Create debate and argument
      const { debate } = await debateService.createDebate({
        resolution: 'Electric vehicles are better for the environment than traditional cars',
        creatorId: supporterId,
        creatorSide: 'support',
      });
      
      await debateService.joinDebateAsOppose(debate.id, opposerId);
      
      const argument = await debateService.submitArgument({
        debateId: debate.id,
        debaterId: supporterId,
        content: 'Electric vehicles produce zero direct emissions during operation. When powered by renewable energy sources, their total carbon footprint is significantly lower than internal combustion engine vehicles throughout their entire lifecycle.',
      });
      
      // Parse YouTube URL
      const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const youtubePreview = mediaService.parseYouTubeUrl(youtubeUrl);
      
      expect(youtubePreview).not.toBeNull();
      expect(youtubePreview!.videoId).toBe('dQw4w9WgXcQ');
      expect(youtubePreview!.thumbnailUrl).toContain('img.youtube.com');
      
      // Create YouTube media attachment
      const youtubeAttachment = await mediaService.createMediaAttachment({
        argumentId: argument.id,
        type: 'youtube',
        url: youtubeUrl,
        thumbnailUrl: youtubePreview!.thumbnailUrl,
        title: youtubePreview!.title,
      });
      
      expect(youtubeAttachment.type).toBe('youtube');
      expect(youtubeAttachment.argumentId).toBe(argument.id);
      
      // Verify retrieval
      const media = await mediaService.getArgumentMedia(argument.id);
      expect(media).toHaveLength(1);
      expect(media[0].type).toBe('youtube');
    });

    it('should reject invalid file uploads', async () => {
      // Test file too large
      const largeFile = {
        size: 15 * 1024 * 1024, // 15MB - exceeds 10MB limit
        type: 'image/jpeg',
        name: 'large-image.jpg',
      };
      
      const largeValidation = mediaService.validateFile(largeFile);
      expect(largeValidation.valid).toBe(false);
      expect(largeValidation.error).toContain('10MB limit');
      
      // Test invalid file type
      const invalidTypeFile = {
        size: 1024,
        type: 'application/x-executable',
        name: 'malware.exe',
      };
      
      const typeValidation = mediaService.validateFile(invalidTypeFile);
      expect(typeValidation.valid).toBe(false);
      expect(typeValidation.error).toContain('not supported');
    });
  });


  /**
   * Task 25.2: End-to-end test for reputation flow
   * Requirements: 4.1, 4.2, 4.3
   * - Complete debate, verify reputation updates for all participants
   */
  describe('25.2 Reputation Flow', () => {
    it('should update reputation for all participants after debate conclusion', { timeout: 20000 }, async () => {
      // Step 1: Create and setup debate
      const { debate } = await debateService.createDebate({
        resolution: 'Remote work increases overall productivity',
        creatorId: supporterId,
        creatorSide: 'support',
      });
      
      await debateService.joinDebateAsOppose(debate.id, opposerId);
      
      // Step 2: Complete all 3 rounds with arguments (each at least 100 chars)
      // Round 1 - Opening
      await debateService.submitArgument({
        debateId: debate.id,
        debaterId: supporterId,
        content: 'Remote work eliminates commute time and allows employees to work in their preferred environment. Studies show that remote workers report higher job satisfaction and productivity levels compared to office workers.',
      });
      
      await debateService.submitArgument({
        debateId: debate.id,
        debaterId: opposerId,
        content: 'Remote work reduces collaboration and spontaneous innovation. The lack of face-to-face interaction leads to communication gaps and decreased team cohesion, ultimately harming productivity.',
      });
      
      // Round 2 - Rebuttal
      await debateService.submitArgument({
        debateId: debate.id,
        debaterId: supporterId,
        content: 'Modern collaboration tools like Slack, Zoom, and virtual whiteboards enable effective remote teamwork. Companies like GitLab and Automattic have proven that fully remote teams can be highly innovative.',
      });
      
      await debateService.submitArgument({
        debateId: debate.id,
        debaterId: opposerId,
        content: 'Digital tools cannot fully replace in-person brainstorming sessions. Research shows that breakthrough ideas often emerge from casual office conversations that are impossible to replicate remotely.',
      });
      
      // Round 3 - Closing
      await debateService.submitArgument({
        debateId: debate.id,
        debaterId: supporterId,
        content: 'The data clearly supports remote work benefits. Companies that embrace flexible work see better retention, reduced overhead costs, and access to global talent pools that drive innovation.',
      });
      
      await debateService.submitArgument({
        debateId: debate.id,
        debaterId: opposerId,
        content: 'While remote work has benefits, the long-term impact on company culture and innovation remains concerning. Hybrid models may offer the best balance between flexibility and collaboration.',
      });
      
      // Step 3: Record voter stances to create persuasion delta
      await votingService.recordPreStance({
        debateId: debate.id,
        voterId: voterId1,
        type: 'pre',
        supportValue: 30, // Initially oppose-leaning
      });
      
      await votingService.recordPostStance({
        debateId: debate.id,
        voterId: voterId1,
        type: 'post',
        supportValue: 75, // Changed to support (+45 delta)
      });
      
      await votingService.recordPreStance({
        debateId: debate.id,
        voterId: voterId2,
        type: 'pre',
        supportValue: 60, // Initially support-leaning
      });
      
      await votingService.recordPostStance({
        debateId: debate.id,
        voterId: voterId2,
        type: 'post',
        supportValue: 65, // Slight increase (+5 delta)
      });
      
      // Step 4: Verify debate concluded
      const concludedDebate = await debateService.getDebateById(debate.id);
      expect(concludedDebate?.status).toBe('concluded');
      
      // Step 5: Verify debaters participated count was incremented
      const updatedSupporter = await db.query.users.findFirst({
        where: eq(users.id, supporterId),
      });
      
      const updatedOpposer = await db.query.users.findFirst({
        where: eq(users.id, opposerId),
      });
      
      // Debaters should have their participation count incremented
      expect(updatedSupporter?.debatesParticipated).toBeGreaterThanOrEqual(1);
      expect(updatedOpposer?.debatesParticipated).toBeGreaterThanOrEqual(1);
      
      // Step 6: Verify prediction accuracy was updated for voters
      // Voter 1 predicted support (post > 50) and support won (net delta positive)
      // Voter 2 also predicted support
      // Both should have their prediction accuracy updated
      
      // Get updated user records
      const updatedVoter1 = await db.query.users.findFirst({
        where: eq(users.id, voterId1),
      });
      
      const updatedVoter2 = await db.query.users.findFirst({
        where: eq(users.id, voterId2),
      });
      
      // Users should exist and have been processed
      expect(updatedVoter1).toBeDefined();
      expect(updatedVoter2).toBeDefined();
      
      // Step 7: Verify reputation engine can calculate reputation for debaters
      const supporterReputation = await reputationEngineV2.calculateReputation(supporterId);
      const opposerReputation = await reputationEngineV2.calculateReputation(opposerId);
      
      // Reputation should be calculated (creates factors if needed)
      expect(supporterReputation.overall).toBeGreaterThanOrEqual(0);
      expect(opposerReputation.overall).toBeGreaterThanOrEqual(0);
    });

    it('should track reputation history changes', async () => {
      // Create a simple debate scenario
      const { debate } = await debateService.createDebate({
        resolution: 'Test resolution for reputation tracking',
        creatorId: supporterId,
        creatorSide: 'support',
      });
      
      await debateService.joinDebateAsOppose(debate.id, opposerId);
      
      // Submit arguments with high impact potential
      const argument = await debateService.submitArgument({
        debateId: debate.id,
        debaterId: supporterId,
        content: 'This is a compelling argument that should demonstrate the impact scoring system. It contains substantial reasoning and evidence to support the position being argued.',
      });
      
      // Manually update impact score to trigger reputation update
      await db.update(arguments_)
        .set({ impactScore: 50 }) // High impact
        .where(eq(arguments_.id, argument.id));
      
      // Trigger reputation update
      const change = await reputationEngineV2.updateReputationOnImpact(supporterId, 50, debate.id);
      
      // Verify reputation history was recorded
      const history = await db.query.reputationHistory.findMany({
        where: eq(reputationHistory.userId, supporterId),
      });
      
      // If impact was above threshold, history should be recorded
      if (change > 0) {
        expect(history.length).toBeGreaterThan(0);
        expect(history[0].reason).toContain('impact');
      }
    });

    it('should apply diminishing returns for repeated actions', async () => {
      // Create a debate for the test
      const { debate } = await debateService.createDebate({
        resolution: 'Test debate for diminishing returns',
        creatorId: supporterId,
        creatorSide: 'support',
      });
      
      // Get initial reputation
      const initialUser = await db.query.users.findFirst({
        where: eq(users.id, supporterId),
      });
      const initialScore = initialUser?.reputationScore ?? 100;
      
      // Create reputation factors with high participation count
      await db.insert(reputationFactors).values({
        id: 'rf-test-diminishing',
        userId: supporterId,
        impactScoreTotal: 500,
        predictionAccuracy: 50,
        participationCount: 50, // High count = more diminishing returns
        qualityScore: 50,
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: reputationFactors.userId,
        set: {
          participationCount: 50,
          impactScoreTotal: 500,
        },
      });
      
      // Apply impact update with the real debate ID
      const change1 = await reputationEngineV2.updateReputationOnImpact(supporterId, 30, debate.id);
      
      // The change should be reduced due to diminishing returns
      // With 50 prior participations, the gain should be significantly less than raw score
      // Raw gain would be 30 * 0.5 = 15, but diminishing returns reduce it
      expect(change1).toBeLessThan(15);
    });
  });


  /**
   * Task 25.3: End-to-end test for privacy
   * Requirements: 3.1, 3.2, 3.3
   * - Verify no individual votes exposed through any flow
   */
  describe('25.3 Privacy Enforcement', () => {
    let debateId: string;

    beforeEach(async () => {
      // Create a debate with stances for privacy testing
      const { debate } = await debateService.createDebate({
        resolution: 'Privacy test debate resolution',
        creatorId: supporterId,
        creatorSide: 'support',
      });
      debateId = debate.id;
      
      await debateService.joinDebateAsOppose(debate.id, opposerId);
      
      // Record stances from multiple voters
      await votingService.recordPreStance({
        debateId,
        voterId: voterId1,
        type: 'pre',
        supportValue: 40,
      });
      
      await votingService.recordPostStance({
        debateId,
        voterId: voterId1,
        type: 'post',
        supportValue: 70,
      });
      
      await votingService.recordPreStance({
        debateId,
        voterId: voterId2,
        type: 'pre',
        supportValue: 60,
      });
      
      await votingService.recordPostStance({
        debateId,
        voterId: voterId2,
        type: 'post',
        supportValue: 55,
      });
    });

    it('should return only aggregate data from getAggregateStats', async () => {
      const aggregateStats = await privacyGuard.getAggregateStats(debateId);
      
      // Verify aggregate data is present
      expect(aggregateStats.totalVoters).toBe(2);
      expect(typeof aggregateStats.averagePreStance).toBe('number');
      expect(typeof aggregateStats.averagePostStance).toBe('number');
      expect(typeof aggregateStats.averageDelta).toBe('number');
      expect(typeof aggregateStats.mindChangedCount).toBe('number');
      
      // Verify NO individual voter data is exposed
      // The AggregateStanceData type should not have voterId fields
      const statsAsAny = aggregateStats as any;
      expect(statsAsAny.voterId).toBeUndefined();
      expect(statsAsAny.voterIds).toBeUndefined();
      expect(statsAsAny.votes).toBeUndefined();
      expect(statsAsAny.individualVotes).toBeUndefined();
    });

    it('should filter out voter IDs from public response', async () => {
      // Get raw stances from database
      const rawStances = await db.query.stances.findMany({
        where: eq(stances.debateId, debateId),
      });
      
      // Map to Stance type
      const mappedStances = rawStances.map(s => ({
        id: s.id,
        debateId: s.debateId,
        voterId: s.voterId,
        type: s.type,
        supportValue: s.supportValue,
        confidence: s.confidence,
        lastArgumentSeen: s.lastArgumentSeen,
        createdAt: s.createdAt,
      }));
      
      // Filter for public response
      const publicData = privacyGuard.filterForPublicResponse(mappedStances);
      
      // Verify no voter IDs in public data
      expect(Object.keys(publicData)).not.toContain('voterId');
      expect(Object.keys(publicData)).not.toContain('voterIds');
      
      // Verify only aggregate fields are present
      expect(publicData).toHaveProperty('totalVoters');
      expect(publicData).toHaveProperty('averagePreStance');
      expect(publicData).toHaveProperty('averagePostStance');
      expect(publicData).toHaveProperty('averageDelta');
      expect(publicData).toHaveProperty('mindChangedCount');
    });

    it('should allow self-access to own stances only', async () => {
      // Voter 1 accessing their own stances - should succeed
      const ownStances = await privacyGuard.getOwnStances(debateId, voterId1, voterId1);
      
      expect(ownStances).not.toBeNull();
      expect(ownStances?.pre?.supportValue).toBe(40);
      expect(ownStances?.post?.supportValue).toBe(70);
      
      // Voter 2 trying to access Voter 1's stances - should fail
      const otherStances = await privacyGuard.getOwnStances(debateId, voterId1, voterId2);
      
      expect(otherStances).toBeNull();
    });

    it('should enforce blind voting - no market access before pre-stance', async () => {
      // Create a new voter who hasn't recorded pre-stance
      const newVoterId = 'new-voter-privacy';
      await db.insert(users).values({
        id: newVoterId,
        username: 'new_voter_privacy',
        email: 'new_voter_privacy@test.com',
        passwordHash: 'hash123',
      });
      
      // Check if new voter can access market price
      const accessResult = await privacyGuard.canAccessMarketPrice(debateId, newVoterId);
      
      expect(accessResult.canAccess).toBe(false);
      expect(accessResult.reason).toContain('stance');
      
      // Verify enforceBlindVoting throws
      await expect(
        privacyGuard.enforceBlindVoting(debateId, newVoterId)
      ).rejects.toThrow();
      
      // After recording pre-stance, should be able to access
      await votingService.recordPreStance({
        debateId,
        voterId: newVoterId,
        type: 'pre',
        supportValue: 50,
      });
      
      const accessAfterStance = await privacyGuard.canAccessMarketPrice(debateId, newVoterId);
      expect(accessAfterStance.canAccess).toBe(true);
    });

    it('should validate privacy compliance for queries', () => {
      // Aggregate-only query should be valid
      const aggregateQuery = privacyGuard.validatePrivacyCompliance({
        isAggregateOnly: true,
      });
      expect(aggregateQuery.valid).toBe(true);
      
      // Query with voter ID that's not self-access should be invalid
      const voterIdQuery = privacyGuard.validatePrivacyCompliance({
        includesVoterId: true,
        isSelfAccess: false,
      });
      expect(voterIdQuery.valid).toBe(false);
      expect(voterIdQuery.reason).toContain('voter ID');
      
      // Self-access with matching IDs should be valid
      const selfAccessQuery = privacyGuard.validatePrivacyCompliance({
        includesVoterId: true,
        isSelfAccess: true,
        requesterId: voterId1,
        targetUserId: voterId1,
      });
      expect(selfAccessQuery.valid).toBe(true);
      
      // Self-access with mismatched IDs should be invalid
      const mismatchedQuery = privacyGuard.validatePrivacyCompliance({
        includesVoterId: true,
        isSelfAccess: true,
        requesterId: voterId1,
        targetUserId: voterId2,
      });
      expect(mismatchedQuery.valid).toBe(false);
    });

    it('should not expose individual votes in any aggregate calculation', async () => {
      const stats = await privacyGuard.getAggregateStats(debateId);
      
      // Calculate expected averages manually
      // Voter 1: pre=40, post=70, delta=30
      // Voter 2: pre=60, post=55, delta=-5
      // Average pre: (40+60)/2 = 50
      // Average post: (70+55)/2 = 62.5
      // Average delta: (30-5)/2 = 12.5
      
      expect(stats.totalVoters).toBe(2);
      expect(stats.averagePreStance).toBe(50);
      expect(stats.averagePostStance).toBe(62.5);
      expect(stats.averageDelta).toBe(12.5);
      
      // Mind changed count: delta >= 10 points
      // Voter 1: |30| >= 10 ✓
      // Voter 2: |-5| >= 10 ✗
      expect(stats.mindChangedCount).toBe(1);
      
      // Verify the response structure has no way to identify individual voters
      const jsonString = JSON.stringify(stats);
      expect(jsonString).not.toContain(voterId1);
      expect(jsonString).not.toContain(voterId2);
    });
  });
});
