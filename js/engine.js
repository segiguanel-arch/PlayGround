// Combat engine — deterministic, DOM-free game rules for Aether Kombat.

import { HERO_HP, LANES, MAX_MANA, HAND_LIMIT, KEYWORDS } from './data.js';

let uidCounter = 0;
const uid = (prefix) => `${prefix}${++uidCounter}`;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeSide(side, name, deckCards) {
  return {
    side, name,
    hp: HERO_HP, maxHp: HERO_HP,
    mana: 0, maxMana: 0,
    turns: 0,
    deck: shuffle(deckCards),
    hand: [],
    board: Array.from({ length: LANES }, () => null),
    fatigue: 0
  };
}

export class Game {
  constructor({ playerName, playerDeck, aiName, aiDeck }) {
    this.state = {
      round: 0,
      turn: 'player',
      phase: 'setup',
      winner: null,
      player: makeSide('player', playerName || 'Wanderer', playerDeck),
      ai: makeSide('ai', aiName || 'The Ashen Warden', aiDeck)
    };
    this.feed = [];
  }

  get player() { return this.state.player; }
  get ai() { return this.state.ai; }
  get over() { return this.state.phase === 'over'; }

  side(side) { return side === 'player' ? this.player : this.ai; }
  foe(side) { return side === 'player' ? this.ai : this.player; }

  log(text, tone = 'neutral', side = 'player') {
    this.feed.push({ text, tone, side, at: Date.now() });
    if (this.feed.length > 60) this.feed.shift();
  }

  start() {
    this.draw('player', 4, true);
    this.draw('ai', 5, true);
    this.state.phase = 'setup';
    this.beginTurn('player', true);
    this.log('The gate opens. Your turn.', 'turn', 'player');
    return this.state;
  }

  draw(side, count = 1, silent = false) {
    const s = this.side(side);
    for (let i = 0; i < count; i++) {
      if (!s.deck.length) {
        s.fatigue += 1;
        s.hp = Math.max(0, s.hp - s.fatigue);
        this.log(`${s.name} draws nothing — fatigue deals ${s.fatigue}.`, 'danger', side);
        this.checkEnd();
        continue;
      }
      const card = s.deck.shift();
      if (s.hand.length >= HAND_LIMIT) {
        this.log(`${s.name}'s hand is full — ${card.name} is burned.`, 'muted', side);
        continue;
      }
      s.hand.push({ hid: uid('h'), card });
      if (!silent) this.log(`${s.name} draws a card.`, 'muted', side);
    }
    return s.hand;
  }

  beginTurn(side, first = false) {
    if (this.over) return;
    const s = this.side(side);
    s.turns += 1;
    s.maxMana = Math.min(MAX_MANA, s.turns);
    s.mana = s.maxMana;
    this.state.turn = side;
    this.state.phase = side;

    if (side === 'player') this.state.round = Math.max(1, this.state.round + (first ? 0 : 1));
    else if (this.state.round === 0) this.state.round = 1;

    // Ready surviving units + regeneration.
    for (const unit of s.board) {
      if (!unit) continue;
      unit.canAttack = true;
      if (unit.keywords.includes('regen') && unit.hp < unit.maxHp) {
        const healed = Math.min(2, unit.maxHp - unit.hp);
        unit.hp += healed;
        this.log(`${unit.card.name} regenerates ${healed}.`, 'heal', side);
      }
    }

    // Draw for the turn (the opening hand was already dealt).
    this.draw(side);
    if (this.over) return;

    if (!first) this.log(`${s.name} begins turn ${s.turns}.`, 'turn', side);
  }

  canPlay(side, handIndex, lane) {
    if (this.over || this.state.phase !== side) return false;
    const s = this.side(side);
    const entry = s.hand[handIndex];
    if (!entry) return false;
    if (lane < 0 || lane >= LANES || s.board[lane]) return false;
    return entry.card.cost <= s.mana;
  }

  playableHand(side) {
    const s = this.side(side);
    return s.hand.map((entry, index) => ({
      index, card: entry.card,
      affordable: entry.card.cost <= s.mana,
      lanes: s.board.map((u, i) => (!u && entry.card.cost <= s.mana ? i : -1)).filter(i => i >= 0)
    }));
  }

  playCard(side, handIndex, lane) {
    if (this.over) return { ok: false, reason: 'The duel is over.' };
    if (this.state.phase !== side) return { ok: false, reason: 'Not your turn.' };
    const s = this.side(side);
    const foe = this.foe(side);
    const entry = s.hand[handIndex];
    if (!entry) return { ok: false, reason: 'That card is gone.' };
    if (lane < 0 || lane >= LANES) return { ok: false, reason: 'Choose a lane.' };
    if (s.board[lane]) return { ok: false, reason: 'That lane is occupied.' };
    const card = entry.card;
    if (card.cost > s.mana) return { ok: false, reason: 'Not enough aether.' };

    s.mana -= card.cost;
    s.hand.splice(handIndex, 1);

    const unit = {
      uid: uid('u'),
      card,
      atk: card.atk,
      hp: card.hp,
      maxHp: card.hp,
      keywords: [...(card.keywords || [])],
      ward: (card.keywords || []).includes('ward'),
      canAttack: (card.keywords || []).includes('rush'),
      lane
    };
    s.board[lane] = unit;
    this.log(`${s.name} summons ${card.name} in lane ${lane + 1}.`, side === 'player' ? 'good' : 'enemy', side);

    const result = { ok: true, unit, blast: null, deaths: [], lane, card, side };
    // Blast: 2 damage to the unit opposite, or the enemy hero if the lane is bare.
    if (unit.keywords.includes('blast')) {
      const victim = foe.board[lane];
      if (victim) {
        const before = victim.hp;
        const dealt = this.damageUnit(foe, lane, 2, unit);
        result.blast = {
          target: 'unit', lane, uid: victim.uid, name: victim.card.name,
          damage: dealt, hpBefore: before, died: !foe.board[lane]
        };
        this.log(`${card.name}'s Blast sears ${victim.card.name} for ${dealt}.`, 'damage', side);
      } else {
        this.damageHero(foe, 2, side);
        result.blast = { target: 'hero', damage: 2, name: foe.name };
        this.log(`${card.name}'s Blast strikes ${foe.name} for 2.`, 'damage', side);
      }
    }
    this.checkEnd();
    return result;
  }

  damageUnit(side, lane, amount, source) {
    const s = typeof side === 'string' ? this.side(side) : side;
    const unit = s.board[lane];
    if (!unit || amount <= 0) return 0;
    if (unit.ward) {
      unit.ward = false;
      this.log(`${unit.card.name}'s Ward shatters and absorbs the blow.`, 'ward', side);
      return 0;
    }
    const dealt = Math.min(amount, unit.hp);
    unit.hp -= amount;
    if (unit.hp <= 0) {
      s.board[lane] = null;
      this.log(`${unit.card.name} is destroyed.`, 'death', side);
    }
    return dealt;
  }

  damageHero(side, amount, by) {
    const s = typeof side === 'string' ? this.side(side) : side;
    if (amount <= 0) return 0;
    s.hp = Math.max(0, s.hp - amount);
    this.log(`${s.name} takes ${amount} damage.`, 'damage', side);
    return amount;
  }

  healHero(side, amount) {
    const s = this.side(side);
    const healed = Math.min(amount, s.maxHp - s.hp);
    if (healed > 0) s.hp += healed;
    return healed;
  }

  attack(side, lane) {
    if (this.over) return { ok: false, reason: 'The duel is over.' };
    if (this.state.phase !== side) return { ok: false, reason: 'Not your turn.' };
    const s = this.side(side);
    const foe = this.foe(side);
    const attacker = s.board[lane];
    if (!attacker) return { ok: false, reason: 'No unit in that lane.' };
    if (!attacker.canAttack) return { ok: false, reason: 'That unit has already acted.' };

    attacker.canAttack = false;
    const defender = foe.board[lane];
    const res = {
      ok: true, side, lane,
      attacker: { uid: attacker.uid, name: attacker.card.name, atk: attacker.atk },
      defender: null,
      kind: 'hero',
      heroDamage: 0,
      damageToDefender: 0,
      damageToAttacker: 0,
      defenderDied: false,
      attackerDied: false,
      cleave: [],
      healed: 0
    };

    if (!defender) {
      const dmg = attacker.atk;
      this.damageHero(foe, dmg, side);
      res.heroDamage = dmg;
      this.log(`${attacker.card.name} strikes ${foe.name} for ${dmg}.`, 'damage', side);
    } else {
      res.kind = 'unit';
      res.defender = {
        uid: defender.uid, name: defender.card.name, atk: defender.atk,
        hpBefore: defender.hp, hpAfter: defender.hp
      };
      let dmgToDef = attacker.atk;
      let dmgToAtk = defender.atk;
      let wardDef = false, wardAtk = false;
      if (defender.ward) { wardDef = true; defender.ward = false; dmgToDef = 0; }
      if (attacker.ward) { wardAtk = true; attacker.ward = false; dmgToAtk = 0; }

      // Simultaneous strike.
      let dealtToDef = 0;
      if (!wardDef) {
        dealtToDef = Math.min(dmgToDef, defender.hp);
        defender.hp -= dmgToDef;
      }
      let dealtToAtk = 0;
      if (!wardAtk) {
        dealtToAtk = Math.min(dmgToAtk, attacker.hp);
        attacker.hp -= dmgToAtk;
      }
      res.damageToDefender = dealtToDef;
      res.damageToAttacker = dealtToAtk;
      res.defender.hpAfter = Math.max(0, defender.hp);
      res.wardDefender = wardDef;
      res.wardAttacker = wardAtk;

      // Cleave splashes adjacent foes.
      if (attacker.keywords.includes('cleave')) {
        for (const adj of [lane - 1, lane + 1]) {
          if (adj < 0 || adj >= LANES) continue;
          const other = foe.board[adj];
          if (!other) continue;
          const before = other.hp;
          const dealt = this.damageUnit(foe, adj, 1, attacker);
          res.cleave.push({ lane: adj, uid: other.uid, name: other.card.name, damage: dealt, hpBefore: before });
          this.log(`${attacker.card.name}'s Cleave carves ${other.card.name} for ${dealt}.`, 'damage', side);
        }
      }

      if (defender.hp <= 0) {
        foe.board[lane] = null;
        res.defenderDied = true;
        this.log(`${defender.card.name} falls to ${attacker.card.name}.`, 'death', side);
      }
      if (attacker.hp <= 0) {
        s.board[lane] = null;
        res.attackerDied = true;
        this.log(`${attacker.card.name} is destroyed in the clash.`, 'death', side);
      }
      if (wardDef) this.log(`${defender.card.name}'s Ward absorbs the strike.`, 'ward', side);
      if (wardAtk) this.log(`${attacker.card.name}'s Ward absorbs the counterstrike.`, 'ward', side);
      if (!res.defenderDied && !wardDef) {
        this.log(`${attacker.card.name} clashes with ${defender.card.name}.`, 'combat', side);
      }

      // Lifesteal from damage actually dealt to the defender.
      if (attacker.keywords.includes('lifesteal') && dealtToDef > 0) {
        const healed = this.healHero(side, dealtToDef);
        res.healed = healed;
        if (healed > 0) this.log(`${attacker.card.name} drains ${healed} life.`, 'heal', side);
      }
    }

    this.checkEnd();
    return res;
  }

  endTurn(side) {
    if (this.over || this.state.phase !== side) return false;
    if (side === 'player') {
      this.state.phase = 'ai';
      this.beginTurn('ai');
      if (!this.over) this.log('The Ashen Warden takes the field.', 'turn', 'ai');
    } else {
      this.state.phase = 'player';
      this.beginTurn('player');
      if (!this.over) this.log('Your turn. The gate is yours to take.', 'turn', 'player');
    }
    return true;
  }

  checkEnd() {
    if (this.state.phase === 'over') return;
    const p = this.player, a = this.ai;
    if (p.hp <= 0 || a.hp <= 0) {
      this.state.phase = 'over';
      this.state.winner = a.hp <= 0 && p.hp > 0 ? 'player' : a.hp <= 0 && p.hp <= 0 ? 'draw' : 'ai';
      this.log(this.state.winner === 'player' ? 'The gate yields. Victory!' :
        this.state.winner === 'draw' ? 'Both souls fall. A draw.' :
          'Your light gutters out. Defeat.', 'end', this.state.winner === 'player' ? 'player' : 'ai');
    }
  }

  concede() {
    if (this.over) return;
    this.state.phase = 'over';
    this.state.winner = 'ai';
    this.state.ai.hp = Math.max(1, this.state.ai.hp);
    this.log('You concede the duel.', 'end', 'ai');
  }

  readyCount(side) {
    return this.side(side).board.filter(u => u && u.canAttack).length;
  }

  deployedCount(side) {
    return this.side(side).board.filter(Boolean).length;
  }

  keywordLabel(id) {
    return KEYWORDS[id]?.name || id;
  }
}
