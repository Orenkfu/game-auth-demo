export interface GameActionType {
    name: string;
    weight: number;
    metadata: () => Record<string, any>;
    followUps?: FollowUpRule[];
}

export interface FollowUpRule {
    actionName: string;
    metadata: (triggerMetadata: Record<string, any>) => Record<string, any>;
}

export interface GameRuleset {
    playerCount: number;
    actions: GameActionType[];
}

function randomPlayer(count: number): string {
    return `player_${Math.floor(Math.random() * count) + 1}`;
}

function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export const GAME_RULES: Record<string, GameRuleset> = {
    'League of Legends': {
        playerCount: 10,
        actions: [
            {
                name: 'player_killed',
                weight: 3,
                metadata: () => ({
                    actorId: randomPlayer(10),
                    targetId: randomPlayer(10),
                    damage: Math.floor(Math.random() * 800) + 200,
                }),
                followUps: [
                    {
                        actionName: 'death',
                        metadata: (trigger) => ({
                            actorId: trigger.targetId,
                            killedBy: trigger.actorId,
                        }),
                    },
                    {
                        actionName: 'gold_earned',
                        metadata: (trigger) => ({
                            actorId: trigger.actorId,
                            value: Math.floor(Math.random() * 200) + 100,
                            source: 'kill',
                        }),
                    },
                ],
            },
            {
                name: 'item_purchased',
                weight: 2,
                metadata: () => ({
                    actorId: randomPlayer(10),
                    item: randomFrom(['Infinity Edge', 'Zhonyas Hourglass', 'Trinity Force', 'Rabadons Deathcap']),
                    value: Math.floor(Math.random() * 3000) + 500,
                }),
            },
            {
                name: 'turret_destroyed',
                weight: 1,
                metadata: () => ({
                    actorId: randomPlayer(10),
                    lane: randomFrom(['top', 'mid', 'bot']),
                    tier: randomFrom([1, 2, 3]),
                }),
                followUps: [
                    {
                        actionName: 'gold_earned',
                        metadata: (trigger) => ({
                            actorId: trigger.actorId,
                            value: 250,
                            source: 'turret',
                        }),
                    },
                ],
            },
            {
                name: 'dragon_slain',
                weight: 1,
                metadata: () => ({
                    actorId: randomPlayer(10),
                    dragonType: randomFrom(['infernal', 'ocean', 'mountain', 'cloud', 'elder']),
                }),
            },
        ],
    },

    'Valorant': {
        playerCount: 10,
        actions: [
            {
                name: 'player_killed',
                weight: 4,
                metadata: () => ({
                    actorId: randomPlayer(10),
                    targetId: randomPlayer(10),
                    weapon: randomFrom(['Vandal', 'Phantom', 'Operator', 'Sheriff', 'Spectre']),
                    headshot: Math.random() > 0.7,
                }),
                followUps: [
                    {
                        actionName: 'death',
                        metadata: (trigger) => ({
                            actorId: trigger.targetId,
                            killedBy: trigger.actorId,
                            weapon: trigger.weapon,
                        }),
                    },
                ],
            },
            {
                name: 'ability_used',
                weight: 5,
                metadata: () => ({
                    actorId: randomPlayer(10),
                    ability: randomFrom(['flash', 'smoke', 'molly', 'wall', 'recon', 'heal']),
                }),
            },
            {
                name: 'spike_planted',
                weight: 1,
                metadata: () => ({
                    actorId: randomPlayer(5),
                    site: randomFrom(['A', 'B', 'C']),
                }),
            },
            {
                name: 'round_ended',
                weight: 1,
                metadata: () => ({
                    winningTeam: randomFrom(['attackers', 'defenders']),
                    roundNumber: Math.floor(Math.random() * 25) + 1,
                }),
            },
        ],
    },

    'TFT': {
        playerCount: 8,
        actions: [
            {
                name: 'unit_purchased',
                weight: 4,
                metadata: () => ({
                    actorId: randomPlayer(8),
                    unit: randomFrom(['Jinx', 'Ekko', 'Vi', 'Jayce', 'Caitlyn', 'Lux']),
                    cost: randomFrom([1, 2, 3, 4, 5]),
                    value: randomFrom([1, 2, 3, 4, 5]),
                }),
            },
            {
                name: 'item_equipped',
                weight: 3,
                metadata: () => ({
                    actorId: randomPlayer(8),
                    item: randomFrom(['Rabadons', 'Guardian Angel', 'Bloodthirster', 'Infinity Edge']),
                    unit: randomFrom(['Jinx', 'Ekko', 'Vi', 'Jayce']),
                }),
            },
            {
                name: 'round_result',
                weight: 2,
                metadata: () => ({
                    actorId: randomPlayer(8),
                    opponentId: randomPlayer(8),
                    result: randomFrom(['win', 'loss']),
                    damageDealt: Math.floor(Math.random() * 15) + 1,
                }),
            },
            {
                name: 'player_eliminated',
                weight: 1,
                metadata: () => ({
                    actorId: randomPlayer(8),
                    placement: Math.floor(Math.random() * 7) + 2,
                }),
            },
        ],
    },

    'Fortnite': {
        playerCount: 100,
        actions: [
            {
                name: 'player_killed',
                weight: 3,
                metadata: () => ({
                    actorId: randomPlayer(100),
                    targetId: randomPlayer(100),
                    weapon: randomFrom(['AR', 'Shotgun', 'Sniper', 'SMG', 'Pickaxe']),
                    distance: Math.floor(Math.random() * 200),
                }),
                followUps: [
                    {
                        actionName: 'death',
                        metadata: (trigger) => ({
                            actorId: trigger.targetId,
                            killedBy: trigger.actorId,
                        }),
                    },
                    {
                        actionName: 'loot_dropped',
                        metadata: (trigger) => ({
                            actorId: trigger.targetId,
                            items: Math.floor(Math.random() * 5) + 1,
                        }),
                    },
                ],
            },
            {
                name: 'structure_built',
                weight: 5,
                metadata: () => ({
                    actorId: randomPlayer(100),
                    type: randomFrom(['wall', 'ramp', 'floor', 'cone']),
                    material: randomFrom(['wood', 'brick', 'metal']),
                }),
            },
            {
                name: 'storm_moved',
                weight: 1,
                metadata: () => ({
                    phase: Math.floor(Math.random() * 8) + 1,
                    playersRemaining: Math.floor(Math.random() * 80) + 2,
                }),
            },
        ],
    },

    'CS2': {
        playerCount: 10,
        actions: [
            {
                name: 'player_killed',
                weight: 4,
                metadata: () => ({
                    actorId: randomPlayer(10),
                    targetId: randomPlayer(10),
                    weapon: randomFrom(['AK-47', 'M4A4', 'AWP', 'Deagle', 'USP-S']),
                    headshot: Math.random() > 0.6,
                }),
                followUps: [
                    {
                        actionName: 'death',
                        metadata: (trigger) => ({
                            actorId: trigger.targetId,
                            killedBy: trigger.actorId,
                            weapon: trigger.weapon,
                        }),
                    },
                ],
            },
            {
                name: 'bomb_planted',
                weight: 1,
                metadata: () => ({
                    actorId: randomPlayer(5),
                    site: randomFrom(['A', 'B']),
                }),
            },
            {
                name: 'grenade_thrown',
                weight: 3,
                metadata: () => ({
                    actorId: randomPlayer(10),
                    type: randomFrom(['smoke', 'flash', 'HE', 'molotov', 'decoy']),
                }),
            },
            {
                name: 'round_ended',
                weight: 1,
                metadata: () => ({
                    winningTeam: randomFrom(['T', 'CT']),
                    roundNumber: Math.floor(Math.random() * 30) + 1,
                    endReason: randomFrom(['elimination', 'bomb_exploded', 'bomb_defused', 'time']),
                }),
            },
        ],
    },
};
