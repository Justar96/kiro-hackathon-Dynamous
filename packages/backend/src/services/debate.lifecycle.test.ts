import { describe, it, expect, beforeEach } from 'vitest';
import { debateService } from './debate.service';
import { votingService } from './voting.service';
import { reputationService } from './reputation.service';
import { marketService } from './market.service';
import { db, users } from '../db';
import { cleanTestDb } from '../db/test-setup';

describe('Debate Lifecycle Integration', () => {
  let debateId: string;
  let supporterId: string;
  let opposerId: string;
  let voterId1: string;
  let voterId2: string;

  beforeEach(async () => {
    // Clean database before each test
    await cleanTestDb();
    
    // Create test users in the database
    supporterId = 'supporter-123';
    opposerId = 'opposer-123';
    voterId1 = 'voter-1';
    voterId2 = 'voter-2';
    
    await db.insert(users).values([
      {
        id: supporterId,
        username: 'supporter',
        email: 'supporter@test.com',
        passwordHash: 'hash123',
      },
      {
        id: opposerId,
        username: 'opposer',
        email: 'opposer@test.com',
        passwordHash: 'hash123',
      },
      {
        id: voterId1,
        username: 'voter1',
        email: 'voter1@test.com',
        passwordHash: 'hash123',
      },
      {
        id: voterId2,
        username: 'voter2',
        email: 'voter2@test.com',
        passwordHash: 'hash123',
      },
    ]);
    
    // Create test debate
    const { debate } = await debateService.createDebate({
      resolution: 'Remote work increases productivity',
      creatorId: supporterId,
      creatorSide: 'support'
    });
    debateId = debate.id;
    
    // Join as opponent
    await debateService.joinDebateAsOppose(debateId, opposerId);
  });

  it('should complete full debate lifecycle with winner determination', { timeout: 15000 }, async () => {
    // Submit arguments for all 3 rounds (each must be at least 100 characters)
    await debateService.submitArgument({
      debateId,
      debaterId: supporterId,
      content: 'Remote work eliminates commute time, allowing more focus on actual work. Studies consistently show that employees who work from home report higher productivity levels.'
    });

    await debateService.submitArgument({
      debateId,
      debaterId: opposerId,
      content: 'Remote work reduces collaboration and team cohesion significantly. The lack of face-to-face interaction leads to communication breakdowns and reduced innovation.'
    });

    // Continue through all rounds...
    // Round 2
    await debateService.submitArgument({
      debateId,
      debaterId: supporterId,
      content: 'Studies show 13% productivity increase in remote workers. This data comes from Stanford research involving thousands of employees over multiple years.'
    });

    await debateService.submitArgument({
      debateId,
      debaterId: opposerId,
      content: 'Those studies ignore decreased innovation from lack of spontaneous interaction. Many breakthrough ideas come from casual office conversations that remote work eliminates.'
    });

    // Round 3
    await debateService.submitArgument({
      debateId,
      debaterId: supporterId,
      content: 'The data speaks for itself - remote work is the future. Companies that embrace flexible work arrangements see better retention and employee satisfaction.'
    });

    await debateService.submitArgument({
      debateId,
      debaterId: opposerId,
      content: 'Human connection drives innovation, not isolation. The most successful companies maintain strong in-person cultures that foster creativity and collaboration.'
    });

    // Record voter stances
    await votingService.recordPreStance({
      debateId,
      voterId: voterId1,
      type: 'pre',
      supportValue: 30 // Initially oppose-leaning
    });

    await votingService.recordPostStance({
      debateId,
      voterId: voterId1,
      type: 'post',
      supportValue: 70 // Changed to support (+40 delta)
    });

    await votingService.recordPreStance({
      debateId,
      voterId: voterId2,
      type: 'pre',
      supportValue: 80 // Initially support
    });

    await votingService.recordPostStance({
      debateId,
      voterId: voterId2,
      type: 'post',
      supportValue: 75 // Slight decrease (-5 delta)
    });

    // Debate should auto-conclude after round 3
    const debate = await debateService.getDebateById(debateId);
    expect(debate?.status).toBe('concluded');

    // Check winner determination
    const marketPrice = await marketService.calculateMarketPrice(debateId);
    expect(marketPrice.supportPrice).toBeGreaterThan(50); // Support should win
    expect(marketPrice.totalVotes).toBe(2);
    expect(marketPrice.mindChangeCount).toBe(2); // Both voters changed their stance
  });

  it('should calculate persuasion delta correctly', async () => {
    await votingService.recordPreStance({
      debateId,
      voterId: voterId1,
      type: 'pre',
      supportValue: 25
    });

    const { delta } = await votingService.recordPostStance({
      debateId,
      voterId: voterId1,
      type: 'post',
      supportValue: 75
    });

    expect(delta.delta).toBe(50); // 75 - 25 = 50
    expect(delta.userId).toBe(voterId1);
    expect(delta.debateId).toBe(debateId);
  });

  it('should update reputation on correct predictions', async () => {
    // Mock a concluded debate where support wins
    const debateResult = {
      debateId,
      winnerSide: 'support' as const,
      finalSupportPrice: 65,
      finalOpposePrice: 35,
      totalMindChanges: 1,
      netPersuasionDelta: 10
    };

    // User predicted support (post-stance > 50)
    await votingService.recordPreStance({
      debateId,
      voterId: voterId1,
      type: 'pre',
      supportValue: 40
    });

    await votingService.recordPostStance({
      debateId,
      voterId: voterId1,
      type: 'post',
      supportValue: 60 // Predicted support wins
    });

    const newReputation = await reputationService.updateReputationOnDebateConclusion(
      voterId1,
      debateId,
      debateResult
    );

    expect(newReputation).toBeGreaterThan(100); // Should get +5 bonus
  });

  it('should track market data points over time', async () => {
    const marketPrice = {
      supportPrice: 55,
      opposePrice: 45,
      totalVotes: 1,
      mindChangeCount: 0
    };

    await marketService.recordDataPoint(debateId, marketPrice);
    
    const chartData = await marketService.getChartData(debateId);
    expect(chartData).toHaveLength(1);
    expect(chartData[0].supportPrice).toBe(55);
  });

  it('should detect stance spikes', async () => {
    // Create an argument first for the foreign key (must be at least 100 characters)
    const argument = await debateService.submitArgument({
      debateId,
      debaterId: supporterId,
      content: 'This is a test argument for spike detection that needs to be at least one hundred characters long to pass validation requirements.'
    });
    
    await marketService.detectAndRecordSpikes(
      debateId,
      45, // previous price
      60, // current price (+15 spike)
      argument.id
    );

    // Verify spike was created by querying the spikes
    const spikes = await marketService.getSpikes(debateId);
    
    // Should have at least one spike record since change > 5%
    expect(spikes.length).toBeGreaterThan(0);
    
    // Find the spike we just created
    const createdSpike = spikes.find(s => s.argumentId === argument.id);
    expect(createdSpike).toBeDefined();
    expect(createdSpike?.deltaAmount).toBe(15); // 60 - 45 = 15
  });
});
