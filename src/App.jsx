import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONSTANTES ET CONFIGURATION ---
const INITIAL_BANKROLL = 12850;
const BOARD_WIDTH = 1200;
const BOARD_HEIGHT = 800;

const SUITS = [
  { symbol: '♥', color: 'text-red-600' },
  { symbol: '♦', color: 'text-red-600' },
  { symbol: '♣', color: 'text-slate-900' },
  { symbol: '♠', color: 'text-slate-900' }
];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const CHIPS = [
  { value: 5, bg: 'bg-green-600', border: 'border-green-800', text: 'text-green-100', inner: 'border-green-300/50' },
  { value: 25, bg: 'bg-orange-500', border: 'border-orange-700', text: 'text-orange-100', inner: 'border-orange-300/50' },
  { value: 100, bg: 'bg-gray-800', border: 'border-gray-900', text: 'text-white', inner: 'border-gray-400/50' },
  { value: 500, bg: 'bg-purple-800', border: 'border-purple-950', text: 'text-white', inner: 'border-purple-400/50' },
  { value: 1000, bg: 'bg-[#1a1a1a]', border: 'border-yellow-600', text: 'text-yellow-400', inner: 'border-yellow-600/50' }
];

// --- GESTION AUDIO ---
const SOUND_URLS = {
  chip: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
  card: 'https://assets.mixkit.co/active_storage/sfx/2051/2051-preview.mp3',
  shuffle: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
  bust: 'https://assets.mixkit.co/active_storage/sfx/2073/2073-preview.mp3',
  win: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'
};

const playSound = (type) => {
  try {
    const audio = new Audio(SOUND_URLS[type]);
    audio.volume = type === 'card' ? 0.2 : 0.4;
    audio.play().catch(() => {});
  } catch (e) {
    console.warn("Impossible de jouer l'audio", e);
  }
};

// --- UTILITAIRES DE JEU ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const createDeck = () => {
  let deck = [];
  for (let i = 0; i < 6; i++) {
    for (let suit of SUITS) {
      for (let value of VALUES) {
        let weight = parseInt(value);
        if (['J', 'Q', 'K'].includes(value)) weight = 10;
        if (value === 'A') weight = 11;
        deck.push({ suit: suit.symbol, color: suit.color, value, weight, id: generateId() });
      }
    }
  }
  return deck.sort(() => Math.random() - 0.5);
};

const calculateHandValue = (cards) => {
  let value = 0;
  let aces = 0;
  cards.forEach(card => {
    value += card.weight;
    if (card.value === 'A') aces += 1;
  });
  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }
  return { value, isSoft: aces > 0 && value <= 21, isBlackjack: cards.length === 2 && value === 21 };
};

const getChipsForAmount = (amount) => {
  let remaining = amount;
  const newChips = [];
  [1000, 500, 100, 25, 5].forEach(val => {
    while(remaining >= val) {
      newChips.push({ id: generateId(), value: val });
      remaining -= val;
    }
  });
  return newChips;
};

const getSavedSession = () => {
  try {
    const saved = localStorage.getItem('blackjack_session');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Erreur de lecture de la sauvegarde", e);
  }
  return null;
};

// --- COMPOSANTS VISUELS (Tailles Fixes pour le Plateau Virtuel) ---
const BoardChip = ({ chipObj }) => (
  <div className={`w-12 h-12 rounded-full border-[3px] shadow-[0_4px_6px_rgba(0,0,0,0.6)] flex items-center justify-center font-bold text-xs select-none ${chipObj.bg} ${chipObj.border} ${chipObj.text}`}>
    <div className={`w-[80%] h-[80%] rounded-full border-2 border-dashed flex items-center justify-center ${chipObj.inner}`}>
      {chipObj.value}
    </div>
  </div>
);

// Puce avec tailles adaptatives uniquement pour le HUD (barre du bas)
const HUDChip = ({ chipObj, className = "" }) => (
  <div className={`w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full border-[2px] md:border-[3px] lg:border-[4px] shadow-[0_4px_6px_rgba(0,0,0,0.6)] flex items-center justify-center font-bold text-[10px] md:text-sm select-none ${chipObj.bg} ${chipObj.border} ${chipObj.text} ${className}`}>
    <div className={`w-[80%] h-[80%] rounded-full border-[1px] md:border-2 border-dashed flex items-center justify-center ${chipObj.inner}`}>
      {chipObj.value}
    </div>
  </div>
);

const Card = ({ card, hidden, delay = 0 }) => {
  useEffect(() => {
    if (performance.now() > 1000) setTimeout(() => playSound('card'), delay * 1000);
  }, [delay]);

  if (hidden) {
    return (
      <div className={`w-20 h-28 bg-red-800 rounded-lg border-2 border-white/80 shadow-[0_4px_10px_rgba(0,0,0,0.5)] bg-[radial-gradient(#b91c1c_2px,transparent_2px)] [background-size:8px_8px]`}>
        <div className="w-full h-full border-4 border-red-900 rounded-md opacity-50"></div>
      </div>
    );
  }
  return (
    <div className={`w-20 h-28 bg-white rounded-lg border border-gray-300 shadow-[0_4px_10px_rgba(0,0,0,0.5)] flex flex-col justify-between p-2 select-none font-sans`}>
      <span className={`text-sm font-bold leading-none ${card.color}`}>{card.value}</span>
      <span className={`text-3xl text-center leading-none ${card.color}`}>{card.suit}</span>
      <span className={`text-sm font-bold leading-none rotate-180 ${card.color}`}>{card.value}</span>
    </div>
  );
};

// --- COMPOSANT PRINCIPAL ---
export default function App() {
  const savedSession = getSavedSession();

  const [gameState, setGameState] = useState(savedSession?.gameState || 'betting');
  const [bankroll, setBankroll] = useState(savedSession?.bankroll !== undefined ? savedSession.bankroll : INITIAL_BANKROLL);
  const [deck, setDeck] = useState(() => {
    if (savedSession?.deck && savedSession.deck.length >= 10) return savedSession.deck;
    return createDeck();
  });
  const [dealerHand, setDealerHand] = useState(savedSession?.dealerHand || { cards: [], status: 'playing' });
  const [spots, setSpots] = useState(() => savedSession?.spots || Array(5).fill(null).map((_, i) => ({
    id: i, chips: [], totalBet: 0, hands: [], activeHandIndex: 0
  })));
  const [activeSpotIndex, setActiveSpotIndex] = useState(savedSession?.activeSpotIndex !== undefined ? savedSession.activeSpotIndex : -1);
  const [selectedChipValue, setSelectedChipValue] = useState(100);
  const [message, setMessage] = useState(savedSession?.gameState && savedSession.gameState !== 'betting' ? "Partie en cours restaurée." : "Faites vos jeux. (5 emplacements)");
  const [handHistory, setHandHistory] = useState(savedSession?.handHistory || []);
  
  // -- ÉTAT DU MENU DÉROULANT DES JETONS --
  const [isChipMenuOpen, setIsChipMenuOpen] = useState(false);

  // -- SYSTÈME DE SCALING (Zomm Automatique) --
  const [boardScale, setBoardScale] = useState(1);
  const boardWrapperRef = useRef(null);
  
  const handleHitRef = useRef();
  const handleStandRef = useRef();

  // Fermer le menu déroulant si l'état de jeu change (ex: quand les cartes sont distribuées)
  useEffect(() => {
    if (gameState !== 'betting') {
      setIsChipMenuOpen(false);
    }
  }, [gameState]);

  useEffect(() => {
    const updateScale = () => {
      if (boardWrapperRef.current) {
        const { clientWidth, clientHeight } = boardWrapperRef.current;
        // On calcule l'échelle nécessaire pour tout faire rentrer, avec 2% de marge de sécurité
        const scaleW = clientWidth / BOARD_WIDTH;
        const scaleH = clientHeight / BOARD_HEIGHT;
        setBoardScale(Math.min(scaleW, scaleH) * 0.98); 
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // --- SAUVEGARDE AUTOMATIQUE ---
  useEffect(() => {
    const sessionToSave = { gameState, bankroll, deck, dealerHand, spots, activeSpotIndex, handHistory };
    localStorage.setItem('blackjack_session', JSON.stringify(sessionToSave));
  }, [gameState, bankroll, deck, dealerHand, spots, activeSpotIndex, handHistory]);

  useEffect(() => {
    if (gameState === 'dealerTurn' && dealerHand.status === 'playing') {
      playDealerTurn(dealerHand.cards, spots, deck);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalMise = spots.reduce((acc, spot) => acc + spot.totalBet, 0);

  // --- ACTIONS ---
  const resetSession = () => {
    if (window.confirm("Quitter la table et réinitialiser vos fonds ? (Retour à 12 850 €)")) {
      playSound('shuffle');
      localStorage.removeItem('blackjack_session');
      setBankroll(INITIAL_BANKROLL);
      setGameState('betting');
      setDeck(createDeck());
      setDealerHand({ cards: [], status: 'playing' });
      setSpots(Array(5).fill(null).map((_, i) => ({ id: i, chips: [], totalBet: 0, hands: [], activeHandIndex: 0 })));
      setActiveSpotIndex(-1);
      setHandHistory([]);
      setMessage("Nouvelle session. Faites vos jeux.");
    }
  };

  const handleSpotClick = (spotId) => {
    if (gameState !== 'betting') return;
    if (bankroll < selectedChipValue) {
      setMessage("Fonds insuffisants !");
      playSound('bust');
      setTimeout(() => setMessage("Faites vos jeux. (5 emplacements)"), 2000);
      return;
    }

    playSound('chip');
    setBankroll(prev => prev - selectedChipValue);
    setSpots(prev => prev.map(spot => {
      if (spot.id === spotId) {
        return {
          ...spot,
          chips: [...spot.chips, { id: generateId(), value: selectedChipValue }],
          totalBet: spot.totalBet + selectedChipValue
        };
      }
      return spot;
    }));
    
    // Auto-ferme le menu de jetons lors d'un pari si ouvert
    if (isChipMenuOpen) setIsChipMenuOpen(false);
  };

  const clearBets = () => {
    if (gameState !== 'betting') return;
    playSound('shuffle');
    let refunded = 0;
    spots.forEach(spot => refunded += spot.totalBet);
    setBankroll(prev => prev + refunded);
    setSpots(Array(5).fill(null).map((_, i) => ({ id: i, chips: [], totalBet: 0, hands: [], activeHandIndex: 0 })));
  };

  const handleAllIn = () => {
    if (gameState !== 'betting' || bankroll === 0) return;
    playSound('chip');
    
    const amountToBet = bankroll;
    setBankroll(0);

    let targetSpotId = 2; 
    let maxBet = -1;
    spots.forEach(s => {
      if (s.totalBet > maxBet && s.totalBet > 0) {
        maxBet = s.totalBet;
        targetSpotId = s.id;
      }
    });

    setSpots(prev => prev.map(spot => {
      if (spot.id === targetSpotId) {
        const addedChips = getChipsForAmount(amountToBet);
        return {
          ...spot,
          chips: [...spot.chips, ...addedChips],
          totalBet: spot.totalBet + amountToBet
        };
      }
      return spot;
    }));
  };

  const selectChip = (value) => {
    if (gameState === 'betting') {
      playSound('chip');
      setSelectedChipValue(value);
      setIsChipMenuOpen(false); // Ferme le menu après sélection
    }
  };

  const startGame = async () => {
    const activeSpots = spots.filter(s => s.totalBet > 0);
    if (activeSpots.length === 0) {
      setMessage("Placez au moins une mise.");
      return;
    }

    playSound('shuffle');
    setGameState('dealing');
    setMessage("Les jeux sont faits...");
    
    let currentDeck = [...deck];
    if (currentDeck.length < 50) {
      currentDeck = createDeck();
      setMessage("Mélange du sabot...");
    }

    const newSpots = [...spots];
    const newDealerCards = [];

    for (let s = 0; s < 5; s++) {
      if (newSpots[s].totalBet > 0) {
        newSpots[s].hands = [{ cards: [currentDeck.pop(), currentDeck.pop()], status: 'playing', bet: newSpots[s].totalBet, netResult: 0 }];
        newSpots[s].activeHandIndex = 0;
      }
    }
    
    newDealerCards.push(currentDeck.pop());
    newDealerCards.push({ ...currentDeck.pop(), hidden: true });

    setDeck(currentDeck);
    setDealerHand({ cards: newDealerCards, status: 'playing' });

    let firstPlayingSpotIndex = -1;
    for (let i = 0; i < 5; i++) {
      if (newSpots[i].hands.length > 0) {
        const handVal = calculateHandValue(newSpots[i].hands[0].cards);
        if (handVal.isBlackjack) {
           newSpots[i].hands[0].status = 'blackjack';
           playSound('win');
        } else if (firstPlayingSpotIndex === -1) {
           firstPlayingSpotIndex = i;
        }
      }
    }

    setSpots(newSpots);

    if (firstPlayingSpotIndex !== -1) {
      setActiveSpotIndex(firstPlayingSpotIndex);
      setGameState('playing');
      setMessage("À vous de jouer !");
    } else {
      setGameState('dealerTurn');
      playDealerTurn(newDealerCards, newSpots, currentDeck);
    }
  };

  const moveToNextHand = (currentSpots, currentSpotIdx) => {
    let nextSpotIdx = -1;
    if (currentSpots[currentSpotIdx].activeHandIndex < currentSpots[currentSpotIdx].hands.length - 1) {
       const updatedSpots = [...currentSpots];
       updatedSpots[currentSpotIdx].activeHandIndex++;
       setSpots(updatedSpots);
       return;
    }

    for (let i = currentSpotIdx + 1; i < 5; i++) {
      if (currentSpots[i].hands.length > 0 && currentSpots[i].hands[0].status === 'playing') {
        nextSpotIdx = i;
        break;
      }
    }

    if (nextSpotIdx !== -1) {
      setActiveSpotIndex(nextSpotIdx);
    } else {
      setActiveSpotIndex(-1);
      setGameState('dealerTurn');
      playDealerTurn(dealerHand.cards, currentSpots, deck);
    }
  };

  const handleHit = () => {
    let currentDeck = [...deck];
    const newCard = currentDeck.pop();
    setDeck(currentDeck);

    const newSpots = [...spots];
    const activeHand = newSpots[activeSpotIndex].hands[newSpots[activeSpotIndex].activeHandIndex];
    activeHand.cards.push(newCard);

    const handVal = calculateHandValue(activeHand.cards);
    if (handVal.value > 21) {
      playSound('bust');
      activeHand.status = 'bust';
      setSpots(newSpots);
      moveToNextHand(newSpots, activeSpotIndex);
    } else if (handVal.value === 21) {
      activeHand.status = 'stand';
      setSpots(newSpots);
      moveToNextHand(newSpots, activeSpotIndex);
    } else {
      setSpots(newSpots);
    }
  };

  const handleStand = () => {
    const newSpots = [...spots];
    newSpots[activeSpotIndex].hands[newSpots[activeSpotIndex].activeHandIndex].status = 'stand';
    setSpots(newSpots);
    moveToNextHand(newSpots, activeSpotIndex);
  };

  useEffect(() => {
    handleHitRef.current = handleHit;
    handleStandRef.current = handleStand;
  });

  useEffect(() => {
    const onKeyDown = (e) => {
      if (gameState === 'playing') {
        if (e.key.toLowerCase() === 't') handleHitRef.current();
        if (e.key.toLowerCase() === 'r') handleStandRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState]);

  const handleDouble = () => {
    const hand = spots[activeSpotIndex].hands[spots[activeSpotIndex].activeHandIndex];
    if (hand.cards.length !== 2 || bankroll < hand.bet) {
      if (bankroll < hand.bet) playSound('bust');
      return;
    }

    playSound('chip');
    setBankroll(prev => prev - hand.bet);
    
    let currentDeck = [...deck];
    const newCard = currentDeck.pop();
    setDeck(currentDeck);

    const newSpots = [...spots];
    const spot = newSpots[activeSpotIndex];
    const activeHand = spot.hands[spot.activeHandIndex];
    
    const addedChips = getChipsForAmount(hand.bet);
    spot.chips.push(...addedChips);
    spot.totalBet += hand.bet;
    
    activeHand.bet *= 2;
    activeHand.cards.push(newCard);

    const handVal = calculateHandValue(activeHand.cards);
    if (handVal.value > 21) {
      playSound('bust');
      activeHand.status = 'bust';
    } else {
      activeHand.status = 'stand';
    }
    
    setSpots(newSpots);
    moveToNextHand(newSpots, activeSpotIndex);
  };

  const handleSplit = () => {
    const hand = spots[activeSpotIndex].hands[spots[activeSpotIndex].activeHandIndex];
    if (hand.cards.length !== 2 || hand.cards[0].weight !== hand.cards[1].weight) return;
    if (bankroll < hand.bet) { playSound('bust'); return; }

    playSound('chip');
    setBankroll(prev => prev - hand.bet);
    
    let currentDeck = [...deck];
    const card1 = currentDeck.pop();
    const card2 = currentDeck.pop();
    setDeck(currentDeck);

    const newSpots = [...spots];
    const spot = newSpots[activeSpotIndex];
    
    const addedChips = getChipsForAmount(hand.bet);
    spot.chips.push(...addedChips);
    spot.totalBet += hand.bet;

    const cardHand1 = hand.cards[0];
    const cardHand2 = hand.cards[1];

    spot.hands = [
      { cards: [cardHand1, card1], status: 'playing', bet: hand.bet, netResult: 0 },
      { cards: [cardHand2, card2], status: 'playing', bet: hand.bet, netResult: 0 }
    ];
    spot.activeHandIndex = 0;

    setSpots(newSpots);
  };

  const playDealerTurn = async (currentDealerCards, currentSpots, currentDeck) => {
    setMessage("Tour du croupier...");
    playSound('card');
    
    const revealedCards = currentDealerCards.map(c => ({...c, hidden: false}));
    setDealerHand({ cards: revealedCards, status: 'playing' });

    let playersAlive = false;
    currentSpots.forEach(s => s.hands.forEach(h => {
       if (h.status === 'stand' || h.status === 'playing') playersAlive = true;
    }));

    let finalCards = [...revealedCards];
    let finalDeck = [...currentDeck];
    let dealerVal = calculateHandValue(finalCards);

    const drawDealerCard = () => {
      if (dealerVal.value < 17 && playersAlive) {
        setTimeout(() => {
          finalCards.push(finalDeck.pop());
          dealerVal = calculateHandValue(finalCards);
          setDealerHand({ cards: [...finalCards], status: 'playing' });
          setDeck([...finalDeck]);
          drawDealerCard(); 
        }, 800);
      } else {
        setTimeout(() => {
          setDealerHand({ cards: finalCards, status: dealerVal.value > 21 ? 'bust' : 'stand' });
          resolvePayouts(currentSpots, dealerVal, finalCards);
        }, 500);
      }
    };
    
    drawDealerCard();
  };

  const resolvePayouts = (finalSpots, dealerVal, finalDealerCards) => {
    let newBankroll = bankroll;
    let totalWonNet = 0;
    const dealerIsBlackjack = calculateHandValue(finalDealerCards).isBlackjack;
    let newHistoryEntries = [];

    const resolvedSpots = finalSpots.map(spot => {
      if (spot.totalBet === 0) return spot;
      let spotNetResult = 0;

      const resolvedHands = spot.hands.map(hand => {
        let outcome = 'lost';
        let net = 0; 
        const pVal = calculateHandValue(hand.cards);

        if (hand.status === 'bust') {
          outcome = 'bust';
          net = -hand.bet;
        } else if (hand.status === 'blackjack') {
          if (dealerIsBlackjack) { outcome = 'push'; net = 0; newBankroll += hand.bet; }
          else { outcome = 'blackjack'; net = hand.bet * 1.5; newBankroll += (hand.bet + net); totalWonNet += net; }
        } else {
          if (dealerVal.value > 21) {
            outcome = 'win'; net = hand.bet; newBankroll += (hand.bet + net); totalWonNet += net;
          } else if (pVal.value > dealerVal.value) {
            outcome = 'win'; net = hand.bet; newBankroll += (hand.bet + net); totalWonNet += net;
          } else if (pVal.value === dealerVal.value) {
             if (dealerIsBlackjack) { outcome = 'lost'; net = -hand.bet; } 
             else { outcome = 'push'; net = 0; newBankroll += hand.bet; }
          } else {
            outcome = 'lost'; net = -hand.bet;
          }
        }
        spotNetResult += net;
        return { ...hand, status: outcome, netResult: net };
      });
      
      newHistoryEntries.push({ id: generateId(), net: spotNetResult });
      return { ...spot, hands: resolvedHands };
    });

    if (totalWonNet > 0) playSound('win');
    
    setHandHistory(prev => [...newHistoryEntries, ...prev].slice(0, 3));
    setBankroll(newBankroll);
    setSpots(resolvedSpots);
    setGameState('gameOver');
    setMessage(dealerVal.value > 21 ? "Le croupier a sauté !" : `Croupier fait ${dealerVal.value}.`);
  };

  const resetGame = () => {
    playSound('shuffle');
    setSpots(spots.map(s => ({ ...s, chips: [], totalBet: 0, hands: [], activeHandIndex: 0 })));
    setDealerHand({ cards: [], status: 'playing' });
    setActiveSpotIndex(-1);
    setGameState('betting');
    setMessage("Faites vos jeux. (5 emplacements)");
  };

  // --- RENDU UI ---
  const activeHandObj = activeSpotIndex >= 0 ? spots[activeSpotIndex]?.hands[spots[activeSpotIndex]?.activeHandIndex] : null;
  const canSplit = activeHandObj && activeHandObj.cards.length === 2 && activeHandObj.cards[0].weight === activeHandObj.cards[1].weight && spots[activeSpotIndex].hands.length === 1;
  const canDouble = activeHandObj && activeHandObj.cards.length === 2;

  // Coordonnées absolues pour s'aligner PARFAITEMENT sur l'arc de la table (Plateau 1200x800)
  // AJUSTÉES : Plus écartées horizontalement et descendues verticalement SOUS la ligne
  const spotPositions = [
    { left: '160px', top: '630px', rotate: '-24deg' },
    { left: '370px', top: '570px', rotate: '-12deg' },
    { left: '600px', top: '550px', rotate: '0deg' },
    { left: '830px', top: '570px', rotate: '12deg' },
    { left: '1040px', top: '630px', rotate: '24deg' }
  ];

  return (
    <div className="h-screen w-screen flex flex-col font-serif overflow-hidden select-none bg-[#0a2612] bg-[radial-gradient(circle_at_50%_40%,#1f5c35_0%,#0a2612_70%)] relative">
      
      {/* Texture de feutrine globale (Background) */}
      <div className="absolute inset-0 opacity-[0.06] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] mix-blend-overlay pointer-events-none z-0"></div>

      {/* --- PLATEAU DE JEU PRINCIPAL (ZOMM AUTOMATIQUE) --- */}
      <div ref={boardWrapperRef} className="flex-1 relative flex items-center justify-center overflow-hidden z-10" onClick={() => isChipMenuOpen && setIsChipMenuOpen(false)}>
        
        {/* Le conteneur virtuel de 1200x800 */}
        <motion.div 
          style={{ width: `${BOARD_WIDTH}px`, height: `${BOARD_HEIGHT}px`, scale: boardScale }}
          animate={{ scale: gameState === 'playing' ? boardScale * 1.05 : gameState === 'dealerTurn' ? boardScale * 0.98 : boardScale }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="relative flex-shrink-0 origin-center"
        >
          {/* PANNEAU HISTORIQUE DES MAINS */}
          {handHistory.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }}
              className="absolute top-6 left-6 z-30 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl flex flex-col gap-2 min-w-[140px] pointer-events-none"
            >
              <span className="text-white/40 text-[10px] uppercase font-sans font-bold tracking-widest mb-1 border-b border-white/10 pb-1">Historique</span>
              <AnimatePresence>
                {handHistory.map((h, index) => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`flex items-center justify-between text-sm font-sans ${index === 0 ? 'opacity-100' : 'opacity-60'}`}>
                    <span className="text-white/80">🃏 Main</span>
                    <span className={`font-bold tabular-nums ${h.net > 0 ? 'text-green-400' : h.net < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {h.net > 0 ? '+' : ''}{h.net} €
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* HEADER BANNER */}
          <AnimatePresence>
            <motion.div 
              key={message}
              initial={{ opacity: 0, y: -20, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0 }}
              className="absolute top-6 left-[50%] z-30 px-8 py-3 bg-black/80 backdrop-blur-md rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-yellow-600/40 text-yellow-400 font-semibold text-base tracking-wide text-center"
            >
              {message}
            </motion.div>
          </AnimatePresence>

          {/* SABOT DE CARTES (Card Shoe) */}
          <div className="absolute top-12 right-12 z-20 flex w-28 h-40 bg-gradient-to-br from-gray-800 to-black rounded-xl border-4 border-[#1c1c1c] shadow-[10px_10px_20px_rgba(0,0,0,0.8)] flex-col items-center justify-end pb-2 transform -rotate-[15deg] perspective-1000">
            <div className="w-[80%] h-[85%] bg-red-950 rounded border border-red-900 shadow-[inset_0_10px_20px_rgba(0,0,0,0.8)] relative overflow-hidden">
                <div className="absolute right-[-20px] top-4 w-full h-full bg-white rounded shadow-sm rotate-6 opacity-90"></div>
                <div className="absolute right-[-25px] top-4 w-full h-full bg-gray-300 rounded shadow-sm rotate-[10deg] opacity-70"></div>
            </div>
            <div className="w-[90%] h-3 bg-[#111] mt-1 rounded-sm border-t border-gray-700"></div>
          </div>

          {/* TABLE INCURVEE ET MARQUAGES */}
          {/* AJUSTÉE : Descendue (top-420px) et élargie (w-1500px) */}
          <div className="absolute top-[420px] left-1/2 -translate-x-1/2 w-[1500px] h-[900px] rounded-[50%] border-[36px] border-[#1a1a1a] shadow-[inset_0_30px_80px_rgba(0,0,0,0.8),0_0_80px_rgba(0,0,0,0.5)] pointer-events-none bg-transparent ring-8 ring-black/40">
            {/* Ligne de démarcation des paris */}
            <div className="absolute top-[64px] left-1/2 -translate-x-1/2 w-[92%] h-[92%] rounded-[50%] border-t-[3px] border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)] pointer-events-none"></div>
          </div>

          {/* ZONE DU CROUPIER */}
          {/* AJUSTÉE : Remontée légèrement (top-90px) */}
          <div className="absolute top-[90px] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <div className="px-5 py-1 mb-4 bg-black/60 rounded-full border border-white/20 text-xs tracking-widest uppercase font-semibold text-white/80 shadow-lg">
              Croupier
              {gameState === 'gameOver' && <span className="ml-3 text-yellow-400 font-bold">{calculateHandValue(dealerHand.cards).value}</span>}
            </div>
            <div className="flex gap-[-20px]">
              <AnimatePresence>
                {dealerHand.cards.map((c, i) => (
                  <motion.div 
                    key={c.id} 
                    initial={{ opacity: 0, x: 150, y: -100, rotateY: 180, scale: 0.5 }}
                    animate={{ opacity: 1, x: 0, y: 0, rotateY: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="relative" 
                    style={{ marginLeft: i > 0 ? '-30px' : '0', zIndex: i }}
                  >
                    <Card card={c} hidden={c.hidden} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* EMPLACEMENTS DES JOUEURS (SPOTS) */}
          <div className="absolute inset-0 z-30 pointer-events-none">
            {spots.map((spot, i) => {
              const pos = spotPositions[i];
              const isActiveSpot = activeSpotIndex === i;
              
              return (
                <motion.div 
                  key={spot.id} 
                  initial={{ x: "-50%", y: "-50%" }}
                  animate={{ 
                    x: "-50%", y: isActiveSpot && gameState === 'playing' ? "calc(-50% - 20px)" : "-50%",
                    scale: isActiveSpot && gameState === 'playing' ? 1.15 : 1
                  }}
                  transition={{ duration: 0.3 }}
                  className={`absolute flex flex-col items-center pointer-events-auto cursor-pointer ${gameState === 'playing' && !isActiveSpot && spot.totalBet > 0 ? 'opacity-60' : 'opacity-100'}`}
                  style={{ left: pos.left, top: pos.top, rotate: pos.rotate }}
                  onClick={() => handleSpotClick(spot.id)}
                >
                  
                  {/* ZONE DE CARTES DU JOUEUR (Ancrée au-dessus du cercle) */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 min-h-[140px] flex justify-center items-end gap-10">
                    {spot.hands.map((hand, hIdx) => {
                      const val = calculateHandValue(hand.cards);
                      const isHandActive = isActiveSpot && spot.activeHandIndex === hIdx;
                      
                      const maxOverlapX = hand.cards.length > 4 ? 12 : 22;
                      const maxOverlapY = hand.cards.length > 4 ? 12 : 22;
                      
                      return (
                        <motion.div 
                          key={hIdx} 
                          animate={hand.status === 'bust' ? { x: [-5, 5, -5, 5, 0] } : {}}
                          transition={{ duration: 0.3 }}
                          className={`relative flex flex-col items-center transition-all duration-300 rounded-2xl ${isHandActive ? 'z-40 ring-4 ring-yellow-400/80 shadow-[0_0_30px_rgba(250,204,21,0.4)] bg-white/10 p-2' : 'z-10 p-2'}`} 
                        >
                          {/* CELEBRATION DE GAIN */}
                          {(hand.status === 'win' || hand.status === 'blackjack') && gameState === 'gameOver' && (
                            <motion.div
                              initial={{ scale: 0, opacity: 1 }}
                              animate={{ scale: [1, 1.5, 2], opacity: [0.6, 0.3, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="absolute inset-[-20px] bg-yellow-400/30 rounded-full blur-2xl z-0 pointer-events-none"
                            />
                          )}

                          {/* CARTES JOUEUR */}
                          <div 
                            className="relative z-10 w-[calc(80px+var(--extra-w))] h-[calc(112px+var(--extra-h))]"
                            style={{
                              '--extra-w': `${Math.max(0, hand.cards.length - 1) * maxOverlapX}px`,
                              '--extra-h': `${Math.max(0, hand.cards.length - 1) * maxOverlapY}px`
                            }}
                          >
                            <AnimatePresence>
                              {hand.cards.map((c, cIdx) => (
                                <motion.div 
                                  key={c.id} 
                                  initial={{ opacity: 0, x: 150, y: -200, scale: 0.5, rotateZ: 45 }}
                                  animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotateZ: 0 }}
                                  transition={{ type: "spring", stiffness: 220, damping: 22 }}
                                  className="absolute top-0 left-0" 
                                  style={{ 
                                    marginLeft: `${cIdx * maxOverlapX}px`, 
                                    marginTop: `${cIdx * maxOverlapY}px`,
                                    zIndex: cIdx + 1
                                  }}
                                >
                                  <Card card={c} />
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                          
                          {/* BADGES / VALEURS / RESULTATS */}
                          {hand.cards.length > 0 && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center z-50 whitespace-nowrap gap-1">
                              
                              {/* STATUT ET NET RESULT (Gains/Pertes) */}
                              {gameState === 'gameOver' && hand.netResult !== undefined ? (
                                <motion.span 
                                  initial={{ scale: 0, y: 5 }} animate={{ scale: 1, y: 0 }} 
                                  className={`px-4 py-1.5 rounded-full text-sm font-black shadow-xl border-2 font-sans tracking-wide uppercase
                                    ${hand.netResult > 0 ? 'bg-gradient-to-b from-green-500 to-green-700 text-white border-green-300 shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 
                                      hand.netResult < 0 ? 'bg-gradient-to-b from-red-600 to-red-800 text-white border-red-400' : 
                                      'bg-gradient-to-b from-gray-600 to-gray-800 text-white border-gray-400'}`}
                                >
                                  {hand.netResult > 0 ? '+' : ''}{hand.netResult} €
                                </motion.span>
                              ) : (
                                <span className="px-3 py-1 bg-black/80 backdrop-blur-md rounded-md text-xs font-bold text-white shadow-md border border-white/20 font-sans">
                                  {val.value} {val.isSoft ? '(S)' : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* CERCLE DE MISE (Point d'ancrage central - Rétreci à w-24 h-24) */}
                  <div className={`w-24 h-24 rounded-full border-[3px] transition-all duration-300 flex items-center justify-center relative ${spot.totalBet > 0 ? 'border-yellow-500/80 shadow-[0_0_10px_rgba(234,179,8,0.2)] bg-black/10' : 'border-white/10 hover:border-white/30'} ${isActiveSpot ? 'bg-white/10 ring-8 ring-yellow-500/20' : ''}`}>
                    
                    <div className="absolute inset-1 rounded-full border border-dashed border-white/20 pointer-events-none"></div>

                    {spot.totalBet > 0 && gameState === 'betting' && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -top-7 text-yellow-400 text-sm font-bold tracking-wider bg-black/60 px-3 py-0.5 rounded-full border border-yellow-500/30 shadow-lg">{spot.totalBet} €</motion.span>
                    )}

                    {/* JETONS DU JOUEUR */}
                    {spot.chips.length > 0 && (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <AnimatePresence>
                          {spot.chips.map((chipObj, cIdx) => {
                            const chipConfig = CHIPS.find(c => c.value === chipObj.value) || CHIPS[0];
                            const displayIdx = Math.min(cIdx, 8);
                            return (
                              <motion.div 
                                key={chipObj.id} 
                                initial={{ y: -50, opacity: 0, scale: 0.5 }}
                                animate={{ y: -(displayIdx * 4), opacity: 1, scale: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: "spring", bounce: 0.4 }}
                                className="absolute"
                              >
                                <BoardChip chipObj={chipConfig} />
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

        </motion.div>
      </div>

      {/* --- HUD : BARRE DE CONTRÔLE ANCRÉE EN BAS --- */}
      <div className="w-full flex-shrink-0 px-2 py-3 md:px-6 md:py-6 bg-gradient-to-b from-[#1a110c] to-[#0a0604] border-t-[4px] md:border-t-[10px] border-[#000000] z-40 flex flex-col md:flex-row justify-between items-center gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.9)] relative">
        
        {/* SÉLECTEUR DE JETONS COMPACT (Menu déroulant vers le haut) */}
        <div className={`relative order-2 md:order-1 flex justify-center z-50 ${gameState !== 'betting' ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
          
          {/* Menu Popup avec toutes les valeurs */}
          <AnimatePresence>
            {isChipMenuOpen && gameState === 'betting' && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 bg-[#1a110c]/95 backdrop-blur-xl p-3 rounded-[32px] border border-[#3e2723] shadow-[0_-10px_30px_rgba(0,0,0,0.8)]"
              >
                {CHIPS.slice().reverse().map(chip => (
                  <motion.div
                    key={chip.value}
                    whileHover={{ scale: 1.15 }}
                    onClick={() => selectChip(chip.value)}
                    className={`cursor-pointer transition-all ${selectedChipValue === chip.value ? 'ring-2 ring-yellow-400/50 rounded-full scale-110 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 'opacity-80 hover:opacity-100'}`}
                  >
                    <HUDChip chipObj={chip} className="shadow-[0_4px_8px_rgba(0,0,0,0.8)] w-10 h-10 md:w-12 md:h-12" />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Jeton Actuel (Bouton principal d'ouverture) */}
          <motion.div
            whileHover={gameState === 'betting' ? { scale: 1.05 } : {}}
            whileTap={gameState === 'betting' ? { scale: 0.95 } : {}}
            onClick={() => {
              if (gameState === 'betting') setIsChipMenuOpen(!isChipMenuOpen);
            }}
            className="cursor-pointer relative flex items-center justify-center p-2 md:p-3 bg-black/60 rounded-full shadow-[inset_0_2px_10px_rgba(0,0,0,0.9)] border border-white/5"
          >
            <HUDChip 
                chipObj={CHIPS.find(c => c.value === selectedChipValue) || CHIPS[0]} 
                className="shadow-[0_8px_15px_rgba(0,0,0,0.8)] ring-[2px] ring-yellow-400/50" 
            />
            {/* Petit indicateur chevron pour montrer que c'est interactif */}
            <div className="absolute -top-1 -right-1 bg-[#3e2723] rounded-full p-0.5 border border-yellow-600/50 text-yellow-500 shadow-[0_2px_5px_rgba(0,0,0,0.5)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            </div>
          </motion.div>
        </div>

        {/* BOUTONS D'ACTION CENTRAUX */}
        <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4 order-3 md:order-2 w-full md:w-auto md:absolute md:left-1/2 md:-translate-x-1/2">
          {gameState === 'betting' && (
            <>
              {totalMise > 0 && (
                 <button onClick={clearBets} className="px-4 py-2 md:px-6 md:py-3 bg-[#241a15] text-white/70 text-xs md:text-sm tracking-wider font-semibold rounded-lg md:rounded-xl border border-[#3e2723] hover:bg-[#3e2723] hover:text-white transition-colors uppercase flex-1 md:flex-none">
                   Effacer
                 </button>
              )}
              {bankroll > 0 && (
                 <button onClick={handleAllIn} className="px-4 py-2 md:px-6 md:py-3 bg-[#3e0b0b] text-red-100 text-xs md:text-sm tracking-wider font-bold rounded-lg md:rounded-xl border border-[#7f1d1d] hover:bg-[#5f1313] hover:text-white shadow-[0_0_10px_rgba(185,28,28,0.2)] transition-colors uppercase flex-1 md:flex-none">
                   All-In
                 </button>
              )}
              <button 
                onClick={startGame} 
                disabled={totalMise === 0}
                className={`px-6 py-2 md:px-12 md:py-4 bg-gradient-to-b from-yellow-500 to-yellow-700 text-black font-black text-sm md:text-lg tracking-widest uppercase rounded-lg md:rounded-xl shadow-[0_4px_15px_rgba(202,138,4,0.5)] border-2 border-yellow-400 transition-all flex-[2] md:flex-none ${totalMise > 0 ? 'hover:from-yellow-400 hover:to-yellow-600 hover:scale-105' : 'opacity-40 cursor-not-allowed grayscale border-transparent'}`}
              >
                Distribuer
              </button>
            </>
          )}

          {gameState === 'playing' && (
            <div className="flex justify-center flex-wrap w-full gap-2 md:gap-4">
               <button onClick={handleHit} className="flex-1 md:flex-none px-4 py-3 md:px-10 md:py-4 bg-gradient-to-b from-[#4caf50] to-[#2e7d32] text-white font-black text-xs md:text-lg tracking-wider uppercase rounded-lg md:rounded-xl shadow-[0_4px_15px_rgba(46,125,50,0.5)] border border-[#66bb6a] hover:from-[#66bb6a] hover:to-[#388e3c] hover:scale-105 transition-all flex items-center justify-center gap-2">
                Tirer <span className="hidden sm:inline bg-black/20 text-[10px] px-1.5 py-0.5 rounded font-sans opacity-70">T</span>
              </button>
              <button onClick={handleStand} className="flex-1 md:flex-none px-4 py-3 md:px-10 md:py-4 bg-gradient-to-b from-red-600 to-red-800 text-white font-black text-xs md:text-lg tracking-wider uppercase rounded-lg md:rounded-xl shadow-[0_4px_15px_rgba(185,28,28,0.5)] border border-red-500 hover:from-red-500 hover:to-red-700 hover:scale-105 transition-all flex items-center justify-center gap-2">
                Rester <span className="hidden sm:inline bg-black/20 text-[10px] px-1.5 py-0.5 rounded font-sans opacity-70">R</span>
              </button>
              
              {canDouble && (
                 <button onClick={handleDouble} className="flex-1 md:flex-none px-4 py-3 md:px-6 md:py-4 bg-gradient-to-b from-yellow-500 to-yellow-600 text-black font-black text-xs md:text-sm tracking-wider uppercase rounded-lg md:rounded-xl shadow-[0_4px_15px_rgba(234,179,8,0.4)] border border-yellow-300 hover:scale-105 transition-all">
                   Doubler
                 </button>
              )}
              {canSplit && (
                 <button onClick={handleSplit} className="flex-1 md:flex-none px-4 py-3 md:px-6 md:py-4 bg-gradient-to-b from-blue-600 to-blue-800 text-white font-black text-xs md:text-sm tracking-wider uppercase rounded-lg md:rounded-xl shadow-[0_4px_15px_rgba(37,99,235,0.4)] border border-blue-400 hover:scale-105 transition-all">
                   Séparer
                 </button>
              )}
            </div>
          )}

          {gameState === 'gameOver' && (
             <button onClick={resetGame} className="w-full md:w-auto px-6 py-3 md:px-12 md:py-4 bg-gradient-to-b from-blue-600 to-blue-900 text-white font-black text-sm md:text-lg tracking-widest uppercase rounded-lg md:rounded-xl shadow-[0_4px_15px_rgba(29,78,216,0.5)] border border-blue-400 hover:from-blue-500 hover:to-blue-800 hover:scale-105 transition-all">
               Nouveaux Jeux
             </button>
          )}
        </div>

        {/* INFO FONDS ET MISE (Droite) */}
        <div className="flex md:flex-col justify-between items-center md:items-stretch w-full md:w-auto text-right text-white bg-[#0a0a0a] border border-[#222] md:border-2 p-2 md:p-4 px-3 md:px-6 rounded-lg md:rounded-xl font-sans shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] order-1 md:order-3">
          
          <div className="flex flex-col md:block items-start">
            <div className="flex items-center gap-2 text-white/50 uppercase tracking-widest text-[10px] mb-1 font-bold">
              <span>Crédits</span>
              <button onClick={resetSession} className="text-red-500/40 hover:text-red-500 transition-colors" title="Quitter la table">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
            <div className="text-yellow-400 font-black text-lg md:text-2xl tabular-nums tracking-wider leading-none md:mb-3">
              {bankroll.toLocaleString('fr-FR')} €
            </div>
          </div>

          <div className="flex flex-col md:block items-end border-l border-white/10 md:border-l-0 md:border-t pl-3 md:pl-0 pt-0 md:pt-2">
            <div className="text-white/50 uppercase tracking-widest text-[10px] mb-1 font-bold md:text-right">
              Mise Totale
            </div>
            <div className="text-white font-bold text-sm md:text-lg tabular-nums tracking-wider leading-none md:text-right">
              {totalMise.toLocaleString('fr-FR')} €
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
