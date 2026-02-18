/**
 * ECAN (Economic Attention Network) Unit Tests
 *
 * Comprehensive tests for attention allocation, spreading, Hebbian learning
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AttentionBank, ECANManager, ECANConfig } from '../ECANAttention';
import { Atom, Link, AttentionValue } from '../../types/cognitive';

// ==================== Test Fixtures ====================

function createTestAtom(
  id: string,
  sti: number,
  lti: number = 50,
  vlti: number = 0
): Atom {
  return {
    id,
    type: 'ConceptNode',
    name: `Concept_${id}`,
    truthValue: { strength: 0.8, confidence: 0.9 },
    attentionValue: { sti, lti, vlti },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function createTestLink(id: string, outgoing: string[]): Link {
  return {
    id,
    type: 'InheritanceLink',
    outgoing,
    truthValue: { strength: 0.8, confidence: 0.9 },
    attentionValue: { sti: 50, lti: 25, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

const defaultConfig: ECANConfig = {
  totalSTI: 100000,
  targetSTI: 50000,
  minSTI: -100,
  maxSTI: 1000,
  stiDecayRate: 0.1,
  ltiDecayRate: 0.01,
  spreadingFactor: 0.2,
  maxSpreadingHops: 3,
  hebbianLearningRate: 0.05,
  coactivationThreshold: 0.7,
  rentCollectionRate: 0.05,
  rentThreshold: 100
};

// ==================== AttentionBank Tests ====================

describe('AttentionBank', () => {
  let bank: AttentionBank;

  beforeEach(() => {
    bank = new AttentionBank(defaultConfig);
  });

  describe('getCurrentSTI', () => {
    it('should return 0 for empty bank', () => {
      expect(bank.getCurrentSTI()).toBe(0);
    });

    it('should return total STI across all atoms', () => {
      bank.allocateSTI('atom1', 100);
      bank.allocateSTI('atom2', 200);
      bank.allocateSTI('atom3', 50);

      expect(bank.getCurrentSTI()).toBe(350);
    });
  });

  describe('allocateSTI', () => {
    it('should allocate STI to new atom', () => {
      const newSTI = bank.allocateSTI('atom1', 100);

      expect(newSTI).toBe(100);
      expect(bank.getCurrentSTI()).toBe(100);
    });

    it('should accumulate STI for existing atom', () => {
      bank.allocateSTI('atom1', 100);
      const newSTI = bank.allocateSTI('atom1', 50);

      expect(newSTI).toBe(150);
    });

    it('should handle negative allocation', () => {
      bank.allocateSTI('atom1', 100);
      const newSTI = bank.allocateSTI('atom1', -30);

      expect(newSTI).toBe(70);
    });
  });

  describe('collectRent', () => {
    it('should collect rent from atom', () => {
      bank.allocateSTI('atom1', 100);
      const rent = bank.collectRent('atom1', 20);

      expect(rent).toBe(20);
      expect(bank.getCurrentSTI()).toBe(80);
    });

    it('should not collect more than available STI', () => {
      bank.allocateSTI('atom1', 50);
      const rent = bank.collectRent('atom1', 100);

      expect(rent).toBe(50);
      expect(bank.getCurrentSTI()).toBe(0);
    });

    it('should return 0 for non-existent atom', () => {
      const rent = bank.collectRent('nonexistent', 100);

      expect(rent).toBe(0);
    });
  });

  describe('normalize', () => {
    it('should scale STI to maintain total', () => {
      bank.allocateSTI('atom1', 50000);
      bank.allocateSTI('atom2', 50000);

      bank.normalize();

      expect(bank.getCurrentSTI()).toBe(defaultConfig.totalSTI);
    });

    it('should maintain relative proportions', () => {
      bank.allocateSTI('atom1', 1000);
      bank.allocateSTI('atom2', 2000);

      bank.normalize();

      const focus = bank.getAttentionalFocus(0);
      // atom2 should still have 2x STI of atom1
      expect(focus[0]).toBe('atom2');
    });

    it('should handle empty bank', () => {
      // Should not throw
      expect(() => bank.normalize()).not.toThrow();
    });
  });

  describe('getAttentionalFocus', () => {
    it('should return atoms above threshold', () => {
      bank.allocateSTI('atom1', 100);
      bank.allocateSTI('atom2', 50);
      bank.allocateSTI('atom3', 200);

      const focus = bank.getAttentionalFocus(100);

      expect(focus).toContain('atom1');
      expect(focus).toContain('atom3');
      expect(focus).not.toContain('atom2');
    });

    it('should return atoms sorted by STI descending', () => {
      bank.allocateSTI('atom1', 100);
      bank.allocateSTI('atom2', 300);
      bank.allocateSTI('atom3', 200);

      const focus = bank.getAttentionalFocus(0);

      expect(focus[0]).toBe('atom2');
      expect(focus[1]).toBe('atom3');
      expect(focus[2]).toBe('atom1');
    });

    it('should return empty array when no atoms above threshold', () => {
      bank.allocateSTI('atom1', 50);
      bank.allocateSTI('atom2', 50);

      const focus = bank.getAttentionalFocus(100);

      expect(focus).toEqual([]);
    });
  });
});

// ==================== ECANManager Tests ====================

describe('ECANManager', () => {
  let manager: ECANManager;

  beforeEach(() => {
    manager = new ECANManager(defaultConfig);
  });

  describe('constructor', () => {
    it('should create manager with default config', () => {
      const defaultManager = new ECANManager();
      const config = defaultManager.getConfig();

      expect(config.totalSTI).toBe(100000);
      expect(config.stiDecayRate).toBe(0.1);
    });

    it('should merge partial config with defaults', () => {
      const customManager = new ECANManager({ stiDecayRate: 0.2 });
      const config = customManager.getConfig();

      expect(config.stiDecayRate).toBe(0.2);
      expect(config.totalSTI).toBe(100000); // default
    });
  });

  describe('updateAttention', () => {
    it('should apply decay to STI', () => {
      const atom = createTestAtom('atom1', 100);
      const newAV = manager.updateAttention(atom);

      // STI should decay by 10% (stiDecayRate = 0.1)
      expect(newAV.sti).toBeLessThan(100);
    });

    it('should apply stimulus', () => {
      const atom = createTestAtom('atom1', 100);
      const newAV = manager.updateAttention(atom, 50);

      // STI should be (100 + 50) * 0.9 = 135
      expect(newAV.sti).toBeGreaterThan(100);
    });

    it('should collect rent above threshold', () => {
      const atom = createTestAtom('atom1', 500);
      const newAV = manager.updateAttention(atom);

      // Rent should be collected since 500 > 100 (threshold)
      expect(newAV.sti).toBeLessThan(500 * 0.9); // Less than just decay
    });

    it('should clamp STI to max', () => {
      const atom = createTestAtom('atom1', 900);
      const newAV = manager.updateAttention(atom, 500);

      expect(newAV.sti).toBeLessThanOrEqual(1000); // maxSTI
    });

    it('should clamp STI to min', () => {
      const atom = createTestAtom('atom1', -50);
      const newAV = manager.updateAttention(atom, -100);

      expect(newAV.sti).toBeGreaterThanOrEqual(-100); // minSTI
    });

    it('should update LTI based on positive STI', () => {
      const atom = createTestAtom('atom1', 100, 50);
      const newAV = manager.updateAttention(atom);

      // LTI should increase when STI > 0
      // newLTI = (50 + 100*0.01) * (1-0.01) = 51 * 0.99 ≈ 50.49
      expect(newAV.lti).toBeGreaterThanOrEqual(50);
    });

    it('should preserve VLTI', () => {
      const atom = createTestAtom('atom1', 100, 50, 10);
      const newAV = manager.updateAttention(atom);

      expect(newAV.vlti).toBe(10);
    });
  });

  describe('spreadImportance', () => {
    it('should spread STI to connected atoms', async () => {
      const source = createTestAtom('source', 500);
      const connected = [
        createTestAtom('target1', 50),
        createTestAtom('target2', 50)
      ];

      const mockGetIncoming = async (atomId: string) => {
        if (atomId === 'source') {
          return [createTestLink('link1', ['source', 'target1'])];
        }
        return [];
      };

      const spreadMap = await manager.spreadImportance(source, connected, mockGetIncoming);

      expect(spreadMap.size).toBeGreaterThan(0);
      expect(spreadMap.has('target1')).toBe(true);
    });

    it('should respect maxSpreadingHops', async () => {
      const source = createTestAtom('source', 1000);

      let hopsReached = 0;
      const mockGetIncoming = async (atomId: string) => {
        hopsReached++;
        return [createTestLink(`link_${atomId}`, [atomId, `next_${hopsReached}`])];
      };

      await manager.spreadImportance(source, [], mockGetIncoming);

      // Should not exceed maxSpreadingHops (3 by default)
      expect(hopsReached).toBeLessThanOrEqual(4); // +1 for initial
    });

    it('should reduce spread with distance', async () => {
      const source = createTestAtom('source', 1000);

      const getIncoming = async (atomId: string) => {
        if (atomId === 'source') {
          return [createTestLink('link1', ['source', 'hop1'])];
        }
        if (atomId === 'hop1') {
          return [createTestLink('link2', ['hop1', 'hop2'])];
        }
        return [];
      };

      const spreadMap = await manager.spreadImportance(source, [], getIncoming);

      const hop1Spread = spreadMap.get('hop1') || 0;
      const hop2Spread = spreadMap.get('hop2') || 0;

      // Closer atoms should receive more spread
      expect(hop1Spread).toBeGreaterThan(hop2Spread);
    });

    it('should stop spreading when amount too small', async () => {
      const source = createTestAtom('source', 10); // Low STI

      const mockGetIncoming = async () => [
        createTestLink('link', ['source', 'target'])
      ];

      const spreadMap = await manager.spreadImportance(source, [], mockGetIncoming);

      // With low STI and spreading factor, spread should be minimal
      expect(spreadMap.size).toBeLessThanOrEqual(1);
    });
  });

  describe('hebbianUpdate', () => {
    it('should return strength increase for coactivated atoms', () => {
      const atom1 = createTestAtom('atom1', 800); // Above threshold (0.7 * 1000 = 700)
      const atom2 = createTestAtom('atom2', 900);

      const increase = manager.hebbianUpdate(atom1, atom2);

      expect(increase).toBeGreaterThan(0);
    });

    it('should return 0 if atoms not in attentional focus', () => {
      const atom1 = createTestAtom('atom1', 100); // Below threshold
      const atom2 = createTestAtom('atom2', 100);

      const increase = manager.hebbianUpdate(atom1, atom2);

      expect(increase).toBe(0);
    });

    it('should return 0 if only one atom above threshold', () => {
      const atom1 = createTestAtom('atom1', 800);
      const atom2 = createTestAtom('atom2', 100); // Below threshold

      const increase = manager.hebbianUpdate(atom1, atom2);

      expect(increase).toBe(0);
    });

    it('should scale with coactivation strength', () => {
      const atom1Low = createTestAtom('atom1', 750);
      const atom2Low = createTestAtom('atom2', 750);

      const atom1High = createTestAtom('atom3', 950);
      const atom2High = createTestAtom('atom4', 950);

      const lowIncrease = manager.hebbianUpdate(atom1Low, atom2Low);
      const highIncrease = manager.hebbianUpdate(atom1High, atom2High);

      expect(highIncrease).toBeGreaterThan(lowIncrease);
    });
  });

  describe('shouldForget', () => {
    it('should not forget atoms with high VLTI', () => {
      const atom = createTestAtom('atom1', -200, 0, 10);

      expect(manager.shouldForget(atom)).toBe(false);
    });

    it('should not forget atoms with high LTI', () => {
      const atom = createTestAtom('atom1', -200, 150, 0);

      expect(manager.shouldForget(atom)).toBe(false);
    });

    it('should forget atoms with STI below minimum', () => {
      const atom = createTestAtom('atom1', -150, 50, 0);

      expect(manager.shouldForget(atom)).toBe(true);
    });

    it('should not forget atoms with STI above minimum', () => {
      const atom = createTestAtom('atom1', 50, 50, 0);

      expect(manager.shouldForget(atom)).toBe(false);
    });
  });

  describe('getAttentionalFocus', () => {
    it('should return atoms with positive STI sorted by STI', () => {
      const atoms = [
        createTestAtom('atom1', 100),
        createTestAtom('atom2', 300),
        createTestAtom('atom3', -50),
        createTestAtom('atom4', 200)
      ];

      const focus = manager.getAttentionalFocus(atoms);

      expect(focus[0].id).toBe('atom2');
      expect(focus[1].id).toBe('atom4');
      expect(focus[2].id).toBe('atom1');
      expect(focus.find(a => a.id === 'atom3')).toBeUndefined();
    });

    it('should respect topN parameter', () => {
      const atoms = [
        createTestAtom('atom1', 100),
        createTestAtom('atom2', 300),
        createTestAtom('atom3', 200)
      ];

      const focus = manager.getAttentionalFocus(atoms, 2);

      expect(focus.length).toBe(2);
    });

    it('should return empty array when no positive STI', () => {
      const atoms = [
        createTestAtom('atom1', -50),
        createTestAtom('atom2', -100)
      ];

      const focus = manager.getAttentionalFocus(atoms);

      expect(focus.length).toBe(0);
    });
  });

  describe('stimulate', () => {
    it('should increase STI', () => {
      const atom = createTestAtom('atom1', 100);
      const newAV = manager.stimulate(atom, 50);

      expect(newAV.sti).toBeGreaterThan(atom.attentionValue.sti * 0.9);
    });

    it('should call updateAttention with stimulus', () => {
      const atom = createTestAtom('atom1', 100);
      const stimulated = manager.stimulate(atom, 100);
      const updated = manager.updateAttention(atom, 100);

      expect(stimulated.sti).toBe(updated.sti);
    });
  });

  describe('allocateAttention', () => {
    it('should distribute equally without weights', () => {
      const atoms = [
        createTestAtom('atom1', 100),
        createTestAtom('atom2', 100),
        createTestAtom('atom3', 100)
      ];

      const allocation = manager.allocateAttention(atoms, 300);

      expect(allocation.get('atom1')).toBe(100);
      expect(allocation.get('atom2')).toBe(100);
      expect(allocation.get('atom3')).toBe(100);
    });

    it('should distribute by weights', () => {
      const atoms = [
        createTestAtom('atom1', 100),
        createTestAtom('atom2', 100)
      ];

      const weights = new Map([
        ['atom1', 1],
        ['atom2', 3]
      ]);

      const allocation = manager.allocateAttention(atoms, 400, weights);

      expect(allocation.get('atom1')).toBe(100);
      expect(allocation.get('atom2')).toBe(300);
    });

    it('should handle atoms not in weights map', () => {
      const atoms = [
        createTestAtom('atom1', 100),
        createTestAtom('atom2', 100)
      ];

      const weights = new Map([['atom1', 1]]);

      const allocation = manager.allocateAttention(atoms, 100, weights);

      expect(allocation.get('atom1')).toBe(100);
      expect(allocation.get('atom2')).toBe(0);
    });
  });

  describe('runCycle', () => {
    it('should update all atoms', async () => {
      const atoms = [
        createTestAtom('atom1', 100),
        createTestAtom('atom2', 200)
      ];

      const mockGetIncoming = async () => [];

      const updates = await manager.runCycle(atoms, mockGetIncoming);

      expect(updates.size).toBe(2);
      expect(updates.has('atom1')).toBe(true);
      expect(updates.has('atom2')).toBe(true);
    });

    it('should apply decay to all atoms', async () => {
      const atoms = [createTestAtom('atom1', 100)];
      const mockGetIncoming = async () => [];

      const updates = await manager.runCycle(atoms, mockGetIncoming);

      // Decay should be applied
      expect(updates.get('atom1')!.sti).toBeLessThan(100);
    });

    it('should spread importance from focus atoms', async () => {
      const atoms = [
        createTestAtom('highSTI', 800),
        createTestAtom('target', 50)
      ];

      const mockGetIncoming = async (atomId: string) => {
        if (atomId === 'highSTI') {
          return [createTestLink('link', ['highSTI', 'target'])];
        }
        return [];
      };

      const updates = await manager.runCycle(atoms, mockGetIncoming);

      // Target should receive spread from highSTI
      const targetAV = updates.get('target');
      expect(targetAV).toBeDefined();
    });
  });

  describe('getStatistics', () => {
    it('should calculate total STI', () => {
      const atoms = [
        createTestAtom('atom1', 100),
        createTestAtom('atom2', 200),
        createTestAtom('atom3', 50)
      ];

      const stats = manager.getStatistics(atoms);

      expect(stats.totalSTI).toBe(350);
    });

    it('should calculate average STI', () => {
      const atoms = [
        createTestAtom('atom1', 100),
        createTestAtom('atom2', 200),
        createTestAtom('atom3', 50)
      ];

      const stats = manager.getStatistics(atoms);

      expect(stats.averageSTI).toBeCloseTo(116.67, 1);
    });

    it('should calculate total and average LTI', () => {
      const atoms = [
        createTestAtom('atom1', 100, 50),
        createTestAtom('atom2', 100, 100),
        createTestAtom('atom3', 100, 75)
      ];

      const stats = manager.getStatistics(atoms);

      expect(stats.totalLTI).toBe(225);
      expect(stats.averageLTI).toBe(75);
    });

    it('should count focus atoms', () => {
      const atoms = [
        createTestAtom('atom1', 100),
        createTestAtom('atom2', 200),
        createTestAtom('atom3', -50)
      ];

      const stats = manager.getStatistics(atoms);

      expect(stats.focusSize).toBe(2);
    });

    it('should count forgettable atoms', () => {
      const atoms = [
        createTestAtom('atom1', -150, 50, 0), // Forgettable
        createTestAtom('atom2', -150, 150, 0), // High LTI, not forgettable
        createTestAtom('atom3', -150, 0, 10) // High VLTI, not forgettable
      ];

      const stats = manager.getStatistics(atoms);

      expect(stats.forgettableAtoms).toBe(1);
    });

    it('should handle empty atom list', () => {
      const stats = manager.getStatistics([]);

      expect(stats.totalSTI).toBe(0);
      expect(stats.averageSTI).toBe(0);
      expect(stats.focusSize).toBe(0);
    });
  });

  describe('getConfig', () => {
    it('should return copy of config', () => {
      const config = manager.getConfig();

      expect(config).toEqual(expect.objectContaining(defaultConfig));
    });

    it('should not allow mutation of internal config', () => {
      const config = manager.getConfig();
      config.stiDecayRate = 0.5;

      expect(manager.getConfig().stiDecayRate).toBe(0.1);
    });
  });

  describe('updateConfig', () => {
    it('should update config partially', () => {
      manager.updateConfig({ stiDecayRate: 0.2 });

      expect(manager.getConfig().stiDecayRate).toBe(0.2);
      expect(manager.getConfig().totalSTI).toBe(100000); // Unchanged
    });

    it('should apply to subsequent operations', () => {
      manager.updateConfig({ stiDecayRate: 0.5 });

      const atom = createTestAtom('atom1', 100);
      const newAV = manager.updateAttention(atom);

      // 50% decay should result in much lower STI
      expect(newAV.sti).toBeLessThan(60);
    });
  });
});

// ==================== Integration Tests ====================

describe('ECAN Integration', () => {
  it('should maintain economic balance over cycles', async () => {
    const manager = new ECANManager();
    const atoms = [
      createTestAtom('atom1', 500),
      createTestAtom('atom2', 300),
      createTestAtom('atom3', 200)
    ];

    const mockGetIncoming = async () => [];

    let totalBefore = atoms.reduce((sum, a) => sum + a.attentionValue.sti, 0);

    // Run multiple cycles
    for (let i = 0; i < 10; i++) {
      const updates = await manager.runCycle(atoms, mockGetIncoming);
      for (const atom of atoms) {
        atom.attentionValue = updates.get(atom.id) || atom.attentionValue;
      }
    }

    // Total STI should decrease due to decay
    let totalAfter = atoms.reduce((sum, a) => sum + a.attentionValue.sti, 0);
    expect(totalAfter).toBeLessThan(totalBefore);
  });

  it('should allow Hebbian learning between coactivated atoms', () => {
    const manager = new ECANManager();

    // Both atoms in focus
    const atom1 = createTestAtom('atom1', 800);
    const atom2 = createTestAtom('atom2', 900);

    const link = createTestLink('link', ['atom1', 'atom2']);

    const strengthIncrease = manager.hebbianUpdate(atom1, atom2, link);

    expect(strengthIncrease).toBeGreaterThan(0);
  });

  it('should identify atoms ready for forgetting', () => {
    const manager = new ECANManager();

    const atoms = [
      createTestAtom('active', 500, 100, 0),
      createTestAtom('dormant', -150, 50, 0),
      createTestAtom('important', -150, 200, 0),
      createTestAtom('permanent', -150, 0, 10)
    ];

    const forgettable = atoms.filter(a => manager.shouldForget(a));

    expect(forgettable.length).toBe(1);
    expect(forgettable[0].id).toBe('dormant');
  });
});
