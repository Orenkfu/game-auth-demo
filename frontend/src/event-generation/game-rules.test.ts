import { GAME_RULES } from './game-rules';

describe('GameRules', () => {
    const gameNames = Object.keys(GAME_RULES);

    it('should have rulesets for all expected games', () => {
        expect(gameNames).toContain('League of Legends');
        expect(gameNames).toContain('Valorant');
        expect(gameNames).toContain('TFT');
        expect(gameNames).toContain('Fortnite');
        expect(gameNames).toContain('CS2');
    });

    describe.each(gameNames)('%s', (gameName) => {
        const ruleset = GAME_RULES[gameName];

        it('should have a positive playerCount', () => {
            expect(ruleset.playerCount).toBeGreaterThan(0);
        });

        it('should have at least one action', () => {
            expect(ruleset.actions.length).toBeGreaterThan(0);
        });

        it('should have positive weights on all actions', () => {
            for (const action of ruleset.actions) {
                expect(action.weight).toBeGreaterThan(0);
            }
        });

        it('should generate valid metadata from all actions', () => {
            for (const action of ruleset.actions) {
                const metadata = action.metadata();
                expect(typeof metadata).toBe('object');
                expect(metadata).not.toBeNull();
            }
        });

        it('should generate valid follow-up metadata', () => {
            for (const action of ruleset.actions) {
                if (!action.followUps) continue;

                const triggerMetadata = action.metadata();
                for (const followUp of action.followUps) {
                    const followUpMetadata = followUp.metadata(triggerMetadata);
                    expect(typeof followUpMetadata).toBe('object');
                    expect(followUpMetadata).not.toBeNull();
                }
            }
        });

        it('follow-ups should reference trigger metadata correctly', () => {
            for (const action of ruleset.actions) {
                if (!action.followUps) continue;

                const triggerMetadata = action.metadata();

                for (const followUp of action.followUps) {
                    const followUpMetadata = followUp.metadata(triggerMetadata);

                    // If follow-up has actorId, it should come from trigger
                    if ('actorId' in followUpMetadata && 'actorId' in triggerMetadata) {
                        // death's actorId is the trigger's targetId
                        if (followUp.actionName === 'death') {
                            expect(followUpMetadata.actorId).toBe(triggerMetadata.targetId);
                        }
                    }

                    // gold_earned from kills should reference the killer
                    if (followUp.actionName === 'gold_earned' && action.name === 'player_killed') {
                        expect(followUpMetadata.actorId).toBe(triggerMetadata.actorId);
                    }
                }
            }
        });
    });
});
