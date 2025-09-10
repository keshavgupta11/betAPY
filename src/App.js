import React, { useState, useEffect } from 'react';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: '✅',
    error: '❌', 
    warning: '⚠️',
    info: 'ℹ️'
  };

  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      background: 'linear-gradient(145deg, rgba(26, 31, 46, 0.9) 0%, rgba(17, 24, 39, 0.6) 50%, rgba(15, 23, 42, 0.3) 100%)',
      border: `1px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#374151'}`,
      borderRadius: '1rem',
      padding: '1rem 1.5rem',
      color: '#ffffff',
      fontWeight: '500',
      zIndex: 1000,
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      maxWidth: '400px',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      animation: 'slideInRight 0.5s ease-out'
    }}>
      <span style={{ fontSize: '1.25rem' }}>{icons[type]}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{
        background: 'none',
        border: 'none',
        color: '#9ca3af',
        cursor: 'pointer',
        fontSize: '1.25rem',
        padding: '0.25rem',
        borderRadius: '0.25rem',
        transition: 'color 0.2s ease'
      }}>×</button>
    </div>
  );
};

export default function App() {
  const initialMarkets = {
    "JitoSol": { apy: 7.98, symbol: "JitoSOL" },
    "Lido stETH": { apy: 2.88, symbol: "stETH" },
    "Aave ETH Lending": { apy: 1.9, symbol: "aETH" },
    "Aave ETH Borrowing": { apy: 2.62, symbol: "aETHBorrow" },
    "Rocketpool rETH": { apy: 2.64, symbol: "rETH" }
  };

  const [marketSettings, setMarketSettings] = useState(initialMarkets);
  const [selectedMarket, setSelectedMarket] = useState("JitoSol");
  const [betAmount, setBetAmount] = useState(1000);
  const [userBalance, setUserBalance] = useState(10000);
  const [protocolTreasury, setProtocolTreasury] = useState(50000);
  const [activeBets, setActiveBets] = useState([]);
  const [activeTab, setActiveTab] = useState("Betting");
  const [pendingBet, setPendingBet] = useState(null);
  const [isSettlement, setIsSettlement] = useState(false);
  const [settlementPrices, setSettlementPrices] = useState({});
  const [pendingSettlement, setPendingSettlement] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [showMarketDropdown, setShowMarketDropdown] = useState(false);
  const [settlementInputs, setSettlementInputs] = useState({});
  const [betMode, setBetMode] = useState('house'); // 'house' or 'peer'
  const [openOrders, setOpenOrders] = useState([]); // For peer-to-peer orders

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const placeBet = (direction) => {
  if (betAmount > userBalance) {
    showToast('Insufficient balance!', 'error');
    return;
  }
  if (betAmount < 10) {
    showToast('Minimum bet is $10', 'error');
    return;
  }
  
  // Calculate betting limits based on treasury
  const maxPerBet = protocolTreasury * 0.1; // 10% of treasury per bet
  const maxPerMarket = protocolTreasury * 0.1; // 10% of treasury per market
  const maxAllMarkets = protocolTreasury * 0.2; // 20% of treasury across all markets
  
  if (betAmount > maxPerBet) {
    showToast(`Maximum bet size is $${maxPerBet.toLocaleString()} (10% of treasury)`, 'error');
    return;
  }
  
  // Check total exposure on this market
  const currentMarketExposure = activeBets
    .filter(bet => bet.market === selectedMarket && bet.status === 'active')
    .reduce((sum, bet) => sum + bet.amount, 0);
  
  if (currentMarketExposure + betAmount > maxPerMarket) {
    const remainingMarketLimit = maxPerMarket - currentMarketExposure;
    showToast(`Market exposure limit: $${remainingMarketLimit.toLocaleString()} remaining on ${selectedMarket}`, 'error');
    return;
  }
  
  // Check total exposure across all markets
  const totalExposure = activeBets
    .filter(bet => bet.status === 'active')
    .reduce((sum, bet) => sum + bet.amount, 0);
  
  if (totalExposure + betAmount > maxAllMarkets) {
    const remainingTotalLimit = maxAllMarkets - totalExposure;
    showToast(`Total exposure limit: $${remainingTotalLimit.toLocaleString()} remaining across all markets`, 'error');
    return;
  }
  
  if (isSettlement) {
    showToast('Cannot place bets during settlement', 'error');
    return;
  }

  // Rest of the placeBet function continues unchanged...

    const currentPrice = marketSettings[selectedMarket].apy;
    let executionPrice;

    if (betMode === 'house') {
      // Add 10bp spread - higher price for betting higher, lower price for betting lower
      const spread = 0.1; // 10 basis points = 0.1%
      executionPrice = direction === 'higher' ? currentPrice + spread : currentPrice - spread;
    } else {
      // Peer-to-peer at current price
      executionPrice = currentPrice;
    }
    
    setPendingBet({
      market: selectedMarket,
      direction,
      amount: betAmount,
      currentPrice: currentPrice.toFixed(3),
      executionPrice: executionPrice.toFixed(3),
      potentialWin: (betAmount * 0.9).toFixed(2),
      mode: betMode
    });
  };

  const confirmBet = () => {
    const { market, direction, amount, currentPrice, executionPrice, mode } = pendingBet;
    
    if (mode === 'house') {
      // Direct bet against house
      const newBet = {
        id: Date.now(),
        market,
        direction,
        amount,
        currentPrice: parseFloat(currentPrice),
        executionPrice: parseFloat(executionPrice),
        timestamp: new Date().toLocaleTimeString(),
        potentialWin: amount * 0.9,
        status: 'active',
        mode: 'house'
      };

      setActiveBets(prev => [...prev, newBet]);
      setUserBalance(prev => prev - amount);
      showToast(`House bet placed: ${direction} on ${market} at ${executionPrice}%`, 'success');
    } else {
      // Create peer-to-peer order
      const newOrder = {
        id: Date.now(),
        market,
        direction,
        amount,
        executionPrice: parseFloat(executionPrice),
        timestamp: new Date().toLocaleTimeString(),
        status: 'open',
        mode: 'peer',
        filled: 0
      };

      setOpenOrders(prev => [...prev, newOrder]);
      setUserBalance(prev => prev - amount);
      showToast(`P2P order created: ${direction} on ${market} at ${executionPrice}%`, 'success');
    }
    
    setPendingBet(null);
  };

  // Function to match peer-to-peer orders (simulate other users taking orders)
  const fillOrder = (orderId, fillAmount = null) => {
    const order = openOrders.find(o => o.id === orderId);
    if (!order) return;

    const amountToFill = fillAmount || order.amount;
    
    // Create active bet from filled order
    const newBet = {
      id: Date.now(),
      market: order.market,
      direction: order.direction,
      amount: amountToFill,
      currentPrice: order.executionPrice,
      executionPrice: order.executionPrice,
      timestamp: new Date().toLocaleTimeString(),
      potentialWin: amountToFill * 0.9,
      status: 'active',
      mode: 'peer'
    };

    setActiveBets(prev => [...prev, newBet]);

    // Update or remove the order (same as before)
    if (amountToFill >= order.amount) {
      setOpenOrders(prev => prev.filter(o => o.id !== orderId));
    } else {
      setOpenOrders(prev => prev.map(o => 
        o.id === orderId 
          ? { ...o, amount: o.amount - amountToFill, filled: o.filled + amountToFill }
          : o
      ));
    }

    showToast(`Order filled: ${amountToFill.toLocaleString()} of ${order.direction} bet`, 'success');
  };

  const requestSettlement = () => {
    const finalPrices = {};
    Object.keys(marketSettings).forEach(market => {
      finalPrices[market] = parseFloat(settlementInputs[market]) || marketSettings[market].apy;
    });
    setPendingSettlement({ prices: finalPrices });
  };

  const confirmSettlement = () => {
    setSettlementPrices(pendingSettlement.prices);
    setIsSettlement(true);
    
    let totalUserWinnings = 0;
    
    const updatedBets = activeBets.map(bet => {
      // Only settle bets that are still active, skip already settled ones
      if (bet.status !== 'active') {
        return bet; // Return unchanged if already settled
      }
      
      const settlementPrice = pendingSettlement.prices[bet.market];
      const isWinner = 
        (bet.direction === 'higher' && settlementPrice > bet.executionPrice) ||
        (bet.direction === 'lower' && settlementPrice < bet.executionPrice);
      
      if (bet.mode === 'peer') {
        // P2P betting logic
        if (isWinner) {
          // For P2P: User gets back original bet + 90% profit
          // Total payout is original bet + 90% profit = bet.amount * 1.9
          const totalPayout = bet.amount + (bet.amount * 0.9); // $1000 + $900 = $1900
          const houseCut = bet.amount * 0.1; // $100 goes to house
          
          totalUserWinnings += totalPayout;
          
          // Add house cut to treasury
          setProtocolTreasury(prev => prev + houseCut);
          
          return { ...bet, status: 'won', settlementPrice };
        } else {
          // User loses, but treasury doesn't gain anything (other user won)
          return { ...bet, status: 'lost', settlementPrice };
        }
      } else {
        // House betting logic (existing code)
        if (isWinner) {
          totalUserWinnings += bet.amount + bet.potentialWin;
          return { ...bet, status: 'won', settlementPrice };
        } else {
          return { ...bet, status: 'lost', settlementPrice };
        }
      }
    });
    
    // Update user balance with their winnings
    setUserBalance(prev => prev + totalUserWinnings);
    
    // Calculate treasury changes for house bets only
    const houseBets = activeBets.filter(bet => bet.mode === 'house' && bet.status === 'active');
    
    const houseLosses = houseBets.filter(bet => {
      const settlementPrice = pendingSettlement.prices[bet.market];
      const isWinner = 
        (bet.direction === 'higher' && settlementPrice > bet.executionPrice) ||
        (bet.direction === 'lower' && settlementPrice < bet.executionPrice);
      return !isWinner;
    }).reduce((sum, bet) => sum + bet.amount, 0);

    const houseWinnerPayouts = houseBets.filter(bet => {
      const settlementPrice = pendingSettlement.prices[bet.market];
      const isWinner = 
        (bet.direction === 'higher' && settlementPrice > bet.executionPrice) ||
        (bet.direction === 'lower' && settlementPrice < bet.executionPrice);
      return isWinner;
    }).reduce((sum, bet) => sum + bet.amount + bet.potentialWin, 0);

    // Update treasury for house bets: gain from losses, lose from payouts
    setProtocolTreasury(prev => prev + houseLosses - houseWinnerPayouts);
    
    setActiveBets(updatedBets);
    setPendingSettlement(null);
    showToast('Settlement completed!', 'success');
  };

  const exitSettlement = () => {
    setIsSettlement(false);
    setSettlementPrices({});
    showToast('Settlement mode exited', 'info');
  };

  const updateMarketSetting = (market, value) => {
    const updated = { ...marketSettings };
    updated[market].apy = parseFloat(value);
    setMarketSettings(updated);
  };

  const handleMarketChange = (newMarket) => {
    setSelectedMarket(newMarket);
    setShowMarketDropdown(false);
  };

  const getMarketLogo = (market) => {
    if (market === "JitoSol") return "/jito.png";
    if (market === "Lido stETH") return "/lido.png";
    if (market === "Aave ETH Lending" || market === "Aave ETH Borrowing") return "/aave.png";
    if (market === "Rocketpool rETH") return "/rocketpool.png";
    return "/default-logo.png";
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #000510 0%, #030712 25%, #0f172a 50%, #111827 100%)',
      color: '#ffffff',
      fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      position: 'relative',
      overflow: 'hidden',
      zoom: 0.7
    }}>
      {/* Enhanced background effects */}
      <div style={{
        position: 'fixed',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: `
          radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.12) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(59, 130, 246, 0.06) 0%, transparent 50%)
        `,
        zIndex: -2,
        animation: 'meshFloat 30s ease-in-out infinite',
        opacity: 0.8
      }} />

      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          linear-gradient(45deg, transparent 49%, rgba(16, 185, 129, 0.02) 50%, transparent 51%),
          linear-gradient(-45deg, transparent 49%, rgba(6, 182, 212, 0.02) 50%, transparent 51%)
        `,
        backgroundSize: '60px 60px',
        zIndex: -1,
        animation: 'gridMove 20s linear infinite'
      }} />

      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}

      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.8rem 1.5rem',
        borderBottom: '1px solid rgba(55, 65, 81, 0.6)',
        background: 'rgba(26, 31, 46, 0.8)',
        backdropFilter: 'blur(20px) saturate(180%)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        height: '60px',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', position: 'relative', padding: '0.3rem 0' }}>
            <h1 style={{
              fontSize: '1.4rem',
              fontWeight: '900',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              margin: 0,
              letterSpacing: '-0.025em',
              position: 'relative',
              transition: 'all 0.3s ease'
            }}>
              betAPY
            </h1>
            <div style={{
              fontSize: '0.65rem',
              color: '#9ca3af',
              fontWeight: '600',
              margin: 0,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              position: 'relative',
              transition: 'all 0.3s ease'
            }}>
              DeFi Yield Prediction
            </div>
          </div>
          <nav style={{ display: 'flex', gap: '1.5rem' }}>
            {['Betting', 'Docs', 'Leaderboard', 'Settings'].map(tab => (
              <span 
                key={tab}
                style={{
                  color: activeTab === tab ? '#10b981' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontWeight: '500',
                  fontSize: '1rem',
                  padding: '0.5rem 0.8rem',
                  position: 'relative',
                  borderRadius: '0.5rem',
                  background: activeTab === tab ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  transform: 'translateY(0)'
                }}
                onClick={() => setActiveTab(tab)}
                onMouseEnter={(e) => {
                  if (activeTab !== tab) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.background = 'rgba(16, 185, 129, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.background = 'transparent';
                  }
                }}
              >
                {tab}
                <div style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '50%',
                  width: activeTab === tab ? '80%' : '0',
                  height: '2px',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)',
                  transition: 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                  transform: 'translateX(-50%)',
                  borderRadius: '1px'
                }} />
              </span>
            ))}
          </nav>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ textAlign: 'right', fontSize: '0.875rem' }}>
            <div style={{ color: '#9ca3af' }}>Balance</div>
            <div style={{ color: '#10b981', fontWeight: '600' }}>
              ${userBalance.toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.875rem' }}>
            <div style={{ color: '#9ca3af' }}>Treasury</div>
            <div style={{ color: '#3b82f6', fontWeight: '600' }}>
              ${protocolTreasury.toLocaleString()}
            </div>
          </div>
        </div>
      </header>

      {activeTab === "Betting" && (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Hero Section */}
          <div style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            marginBottom: '3rem'
          }}>
            <h2 style={{
              fontSize: '3rem',
              fontWeight: '800',
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.025em'
            }}>
              Bet on Crypto Rates
            </h2>
            <p style={{
              fontSize: '1.25rem',
              color: '#9ca3af',
              lineHeight: 1.6,
              maxWidth: '600px',
              margin: '0 auto',
              fontWeight: '500'
            }}>
              Will rates go higher or lower tomorrow? Choose between betting against the house or peer-to-peer trading.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Left Panel - Betting Interface */}
            <div style={{
              background: 'linear-gradient(145deg, rgba(26, 31, 46, 0.9) 0%, rgba(17, 24, 39, 0.6) 50%, rgba(15, 23, 42, 0.3) 100%)',
              backdropFilter: 'blur(16px) saturate(180%)',
              border: '1px solid rgba(55, 65, 81, 0.6)',
              borderRadius: '1.5rem',
              padding: '2.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)',
                opacity: 0.6
              }} />

              {/* Betting Mode Selection */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '1rem', 
                  color: '#ffffff',
                  fontSize: '1.1rem',
                  fontWeight: '700'
                }}>
                  Betting Mode
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <button
                    onClick={() => setBetMode('house')}
                    style={{
                      background: betMode === 'house' ? 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)' : 'rgba(55, 65, 81, 0.6)',
                      color: 'white',
                      border: betMode === 'house' ? 'none' : '1px solid rgba(75, 85, 99, 0.5)',
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      textAlign: 'center'
                    }}
                  >
                    🏠 House Betting
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
                      +/- 10bp spread
                    </div>
                  </button>
                  <button
                    onClick={() => setBetMode('peer')}
                    style={{
                      background: betMode === 'peer' ? 'linear-gradient(135deg, #0891b2 0%, #06b6d4 35%, #22d3ee 70%, #67e8f9 100%)' : 'rgba(55, 65, 81, 0.6)',
                      color: 'white',
                      border: betMode === 'peer' ? 'none' : '1px solid rgba(75, 85, 99, 0.5)',
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      textAlign: 'center'
                    }}
                  >
                    👥 Peer-to-Peer
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
                      Market price
                    </div>
                  </button>
                </div>
              </div>

              {/* Enhanced Market Selection */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '1rem', 
                  color: '#ffffff',
                  fontSize: '1.1rem',
                  fontWeight: '700'
                }}>
                  Select Market
                </label>
                <div style={{ position: 'relative' }}>
                  <div 
                    onClick={() => setShowMarketDropdown(!showMarketDropdown)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem 1.5rem',
                      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%)',
                      border: showMarketDropdown ? '1px solid #10b981' : '1px solid #374151',
                      borderRadius: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(16px)',
                      boxShadow: showMarketDropdown ? '0 8px 32px rgba(16, 185, 129, 0.15)' : '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <img
                        src={getMarketLogo(selectedMarket)}
                        alt={`${selectedMarket} logo`}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: '2px solid rgba(255, 255, 255, 0.1)'
                        }}
                      />
                      <div>
                        <div style={{ 
                          color: '#f1f5f9', 
                          fontWeight: '700', 
                          fontSize: '1.1rem',
                          marginBottom: '0.25rem'
                        }}>
                          {selectedMarket}
                        </div>
                        <div style={{ 
                          color: '#10b981', 
                          fontSize: '0.9rem',
                          fontWeight: '600'
                        }}>
                          {marketSettings[selectedMarket].apy.toFixed(3)}%
                        </div>
                      </div>
                    </div>
                    <div style={{ 
                      color: '#9ca3af', 
                      fontSize: '1.5rem',
                      transform: showMarketDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s ease'
                    }}>
                      ▼
                    </div>
                  </div>

                  {showMarketDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '0.5rem',
                      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
                      border: '1px solid #10b981',
                      borderRadius: '1rem',
                      backdropFilter: 'blur(20px)',
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                      zIndex: 1000,
                      overflow: 'hidden'
                    }}>
                      {Object.keys(marketSettings).map((m, index) => (
                        <div
                          key={m}
                          onClick={() => handleMarketChange(m)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '1rem 1.5rem',
                            cursor: 'pointer',
                            borderBottom: index < Object.keys(marketSettings).length - 1 ? '1px solid rgba(55, 65, 81, 0.3)' : 'none',
                            transition: 'all 0.2s ease',
                            background: selectedMarket === m ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(16, 185, 129, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = selectedMarket === m ? 'rgba(16, 185, 129, 0.1)' : 'transparent';
                          }}
                        >
                          <img
                            src={getMarketLogo(m)}
                            alt={`${m} logo`}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              color: '#f1f5f9', 
                              fontWeight: '600', 
                              fontSize: '1rem',
                              marginBottom: '0.25rem'
                            }}>
                              {m}
                            </div>
                            <div style={{ 
                              color: '#9ca3af', 
                              fontSize: '0.85rem'
                            }}>
                              Live: {marketSettings[m].apy.toFixed(3)}%
                            </div>
                          </div>
                          {selectedMarket === m && (
                            <div style={{
                              color: '#10b981',
                              fontSize: '1.2rem'
                            }}>
                              ✓
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Current Price Display */}
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                background: betMode === 'house' 
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(6, 182, 212, 0.1)',
                borderRadius: '1rem',
                border: betMode === 'house' 
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid rgba(6, 182, 212, 0.3)',
                marginBottom: '2rem',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: betMode === 'house' 
                  ? 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)'
                  : 'linear-gradient(135deg, #0891b2 0%, #06b6d4 35%, #22d3ee 70%, #67e8f9 100%)',
                opacity: 0.6
              }} />
              <div style={{ color: '#9ca3af', fontSize: '1rem', marginBottom: '0.5rem', fontWeight: '500' }}>
                {betMode === 'house' ? 'House Betting Prices' : 'P2P Market Price'}
              </div>
              
              {betMode === 'house' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{
                    padding: '1rem',
                    background: 'rgba(34, 197, 94, 0.1)',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(34, 197, 94, 0.3)'
                  }}>
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Higher</div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '800',
                      color: '#22c55e'
                    }}>
                      {(marketSettings[selectedMarket].apy + 0.1).toFixed(3)}%
                    </div>
                  </div>
                  <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Lower</div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '800',
                      color: '#ef4444'
                    }}>
                      {(marketSettings[selectedMarket].apy - 0.1).toFixed(3)}%
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  fontSize: '3rem',
                  fontWeight: '800',
                  color: '#06b6d4',
                  marginBottom: '0.5rem',
                  textShadow: '0 0 20px rgba(6, 182, 212, 0.3)'
                }}>
                  {marketSettings[selectedMarket].apy.toFixed(3)}%
                </div>
              )}
              
              <div style={{ color: '#9ca3af', fontSize: '0.9rem', fontWeight: '500', marginTop: '1rem' }}>
                {betMode === 'house' 
                  ? 'Instant execution with 10bp spread' 
                  : 'Create order at market price - wait for fill'
                }
              </div>
            </div>

            {/* Bet Amount */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '1rem', 
                color: '#ffffff',
                fontSize: '1.1rem',
                fontWeight: '700'
              }}>
                Bet Amount
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ 
                  position: 'absolute', 
                  left: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#ffffff', 
                  fontSize: '1.2rem',
                  fontWeight: '700',
                  pointerEvents: 'none'
                }}>$</span>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  min="100"
                  max={userBalance}
                  style={{ 
                    width: '100%',
                    padding: '1rem 1rem 1rem 2.5rem',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(75, 85, 99, 0.4)',
                    background: 'rgba(31, 41, 55, 0.8)',
                    color: '#ffffff',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>
              <div style={{ 
                marginTop: '0.5rem', 
                color: '#9ca3af', 
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                Potential winnings: ${(betAmount * 0.9).toLocaleString()}
              </div>
            </div>

            {/* Betting Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button
                onClick={() => placeBet('higher')}
                disabled={isSettlement}
                style={{
                  background: isSettlement ? '#6b7280' : 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '1.5rem',
                  borderRadius: '1rem',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: isSettlement ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'all 0.3s ease',
                  opacity: isSettlement ? 0.5 : 1
                }}
              >
                📈 BET HIGHER
              </button>
              <button
                onClick={() => placeBet('lower')}
                disabled={isSettlement}
                style={{
                  background: isSettlement ? '#6b7280' : 'linear-gradient(135deg, #dc2626 0%, #ef4444 35%, #f87171 70%, #fca5a5 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '1.5rem',
                  borderRadius: '1rem',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: isSettlement ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'all 0.3s ease',
                  opacity: isSettlement ? 0.5 : 1
                }}
              >
                📉 BET LOWER
              </button>
            </div>
          </div>

          {/* Right Panel - Orders and Bets */}
          <div>
            {/* Open P2P Orders */}
            {betMode === 'peer' && (
              <div style={{
                background: 'linear-gradient(145deg, rgba(26, 31, 46, 0.9) 0%, rgba(17, 24, 39, 0.6) 50%, rgba(15, 23, 42, 0.3) 100%)',
                backdropFilter: 'blur(16px) saturate(180%)',
                border: '1px solid rgba(55, 65, 81, 0.6)',
                borderRadius: '1rem',
                padding: '2rem',
                marginBottom: '2rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
              }}>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  marginBottom: '1.5rem',
                  color: '#ffffff'
                }}>
                  Open P2P Orders
                </h3>
                
                {openOrders.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {openOrders.map(order => (
                      <div key={order.id} style={{
                        padding: '1rem',
                        background: 'rgba(26, 31, 46, 0.8)',
                        borderRadius: '0.75rem',
                        border: '1px solid rgba(55, 65, 81, 0.6)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                            {order.market} - {order.direction === 'higher' ? '📈' : '📉'} {order.direction}
                          </div>
                          <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                            ${order.amount.toLocaleString()} at {order.executionPrice.toFixed(3)}%
                          </div>
                        </div>
                        <button
                          onClick={() => fillOrder(order.id)}
                          style={{
                            background: 'linear-gradient(45deg, #059669, #10b981)',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          Fill Order
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
                    No open P2P orders
                  </div>
                )}
              </div>
            )}

            {/* Active Bets Table */}
            <div style={{
              background: 'linear-gradient(145deg, rgba(26, 31, 46, 0.9) 0%, rgba(17, 24, 39, 0.6) 50%, rgba(15, 23, 42, 0.3) 100%)',
              backdropFilter: 'blur(16px) saturate(180%)',
              border: '1px solid rgba(55, 65, 81, 0.6)',
              borderRadius: '1rem',
              padding: '2rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                color: '#ffffff'
              }}>
                Your Bets
              </h3>
              
              {activeBets.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(31, 41, 55, 0.5)' }}>
                        <th style={{ padding: '0.8rem 0.6rem', textAlign: 'left', color: '#9ca3af', borderBottom: '1px solid rgba(55, 65, 81, 0.6)', fontWeight: '600' }}>Market</th>
                        <th style={{ padding: '0.8rem 0.6rem', textAlign: 'left', color: '#9ca3af', borderBottom: '1px solid rgba(55, 65, 81, 0.6)', fontWeight: '600' }}>Mode</th>
                        <th style={{ padding: '0.8rem 0.6rem', textAlign: 'left', color: '#9ca3af', borderBottom: '1px solid rgba(55, 65, 81, 0.6)', fontWeight: '600' }}>Direction</th>
                        <th style={{ padding: '0.8rem 0.6rem', textAlign: 'right', color: '#9ca3af', borderBottom: '1px solid rgba(55, 65, 81, 0.6)', fontWeight: '600' }}>Amount</th>
                        <th style={{ padding: '0.8rem 0.6rem', textAlign: 'right', color: '#9ca3af', borderBottom: '1px solid rgba(55, 65, 81, 0.6)', fontWeight: '600' }}>Entry</th>
                        <th style={{ padding: '0.8rem 0.6rem', textAlign: 'right', color: '#9ca3af', borderBottom: '1px solid rgba(55, 65, 81, 0.6)', fontWeight: '600' }}>Settlement</th>
                        <th style={{ padding: '0.8rem 0.6rem', textAlign: 'center', color: '#9ca3af', borderBottom: '1px solid rgba(55, 65, 81, 0.6)', fontWeight: '600' }}>Status</th>
                        <th style={{ padding: '0.8rem 0.6rem', textAlign: 'right', color: '#9ca3af', borderBottom: '1px solid rgba(55, 65, 81, 0.6)', fontWeight: '600' }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeBets.map(bet => (
                        <tr key={bet.id} style={{ borderBottom: '1px solid rgba(55, 65, 81, 0.3)' }}>
                          <td style={{ padding: '0.8rem 0.6rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <img
                                src={getMarketLogo(bet.market)}
                                alt={bet.market + " logo"}
                                style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                              />
                              <span style={{ color: '#ffffff' }}>{bet.market}</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.8rem 0.6rem' }}>
                            <span style={{
                              color: bet.mode === 'house' ? '#10b981' : '#06b6d4',
                              fontWeight: '600',
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.5rem',
                              background: bet.mode === 'house' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(6, 182, 212, 0.1)'
                            }}>
                              {bet.mode === 'house' ? '🏠' : '👥'} {bet.mode.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 0.6rem' }}>
                            <span style={{
                              color: bet.direction === 'higher' ? '#22c55e' : '#ef4444',
                              fontWeight: '700'
                            }}>
                              {bet.direction === 'higher' ? '📈' : '📉'} {bet.direction.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 0.6rem', textAlign: 'right', fontWeight: '600' }}>
                            ${bet.amount.toLocaleString()}
                          </td>
                          <td style={{ padding: '0.8rem 0.6rem', textAlign: 'right', fontWeight: '600' }}>
                            {bet.executionPrice.toFixed(3)}%
                          </td>
                          <td style={{ padding: '0.8rem 0.6rem', textAlign: 'right' }}>
                            {bet.settlementPrice ? `${bet.settlementPrice.toFixed(3)}%` : '-'}
                          </td>
                          <td style={{ padding: '0.8rem 0.6rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '0.4rem 0.8rem',
                              borderRadius: '1rem',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              color: bet.status === 'won' ? '#22c55e' : bet.status === 'lost' ? '#ef4444' : '#f59e0b',
                              background: bet.status === 'won' ? 'rgba(34, 197, 94, 0.1)' : bet.status === 'lost' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'
                            }}>
                              {bet.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 0.6rem', textAlign: 'right', fontWeight: '800' }}>
                            {bet.status === 'won' && (
                              <span style={{ color: '#22c55e' }}>
                                +${(bet.amount + bet.potentialWin).toLocaleString()}
                              </span>
                            )}
                            {bet.status === 'lost' && (
                              <span style={{ color: '#ef4444' }}>
                                -${bet.amount.toLocaleString()}
                              </span>
                            )}
                            {bet.status === 'active' && (
                              <span style={{ color: '#f59e0b' }}>Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🎲</div>
                  <p>No active bets yet. Place your first bet!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Settings Tab */}
      {activeTab === "Settings" && (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '1.8rem',
            fontWeight: '700',
            marginBottom: '1.5rem',
            color: '#ffffff',
            background: 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Settlement & Settings
          </h2>

          {/* Settlement Section */}
          <div style={{
            background: 'linear-gradient(145deg, rgba(26, 31, 46, 0.9) 0%, rgba(17, 24, 39, 0.6) 50%, rgba(15, 23, 42, 0.3) 100%)',
            border: '1px solid rgba(55, 65, 81, 0.6)',
            borderRadius: '0.8rem',
            padding: '1.2rem',
            marginBottom: '1.5rem',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: '600',
              marginBottom: '1.2rem',
              color: '#ffffff'
            }}>
              Settlement
            </h3>
            
            {!isSettlement ? (
              <div>
                <p style={{ 
                  color: '#9ca3af', 
                  marginBottom: '1.5rem',
                  fontSize: '1rem'
                }}>
                  Enter tomorrow's actual rates to settle all active bets.
                </p>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                  gap: '1.2rem',
                  marginBottom: '2rem'
                }}>
                  {Object.keys(marketSettings).map(market => (
                    <div key={market}>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '1rem', 
                        color: '#ffffff',
                        fontWeight: '700'
                      }}>
                        {market}
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder={marketSettings[market].apy.toFixed(3)}
                        style={{
                          width: '100%',
                          padding: '0.6rem 0.8rem',
                          borderRadius: '0.6rem',
                          border: '1px solid rgba(75, 85, 99, 0.4)',
                          background: 'rgba(31, 41, 55, 0.8)',
                          color: '#ffffff',
                          fontWeight: '500'
                        }}
                        onChange={(e) => {
                          setSettlementInputs(prev => ({
                            ...prev,
                            [market]: e.target.value
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={requestSettlement}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '1rem 2rem',
                    borderRadius: '1rem',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                >
                  Settle All Bets
                </button>
              </div>
            ) : (
              <div>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  marginBottom: '1rem'
                }}>
                  <span style={{ color: '#f59e0b', fontWeight: '600' }}>Settlement Mode Active</span>
                </div>
                
                <h4 style={{ color: '#ffffff', marginBottom: '1rem' }}>Settlement Prices:</h4>
                {Object.keys(settlementPrices).map(market => (
                  <div key={market} style={{ 
                    fontSize: '0.875rem', 
                    color: '#e5e7eb',
                    marginBottom: '0.5rem'
                  }}>
                    {market}: {settlementPrices[market].toFixed(3)}%
                  </div>
                ))}
                
                <button
                  onClick={exitSettlement}
                  style={{
                    background: 'linear-gradient(45deg, #6b7280, #4b5563)',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.75rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                    marginTop: '1rem'
                  }}
                >
                  Exit Settlement Mode
                </button>
              </div>
            )}
          </div>

          {/* Market Settings */}
          <div style={{
            background: 'linear-gradient(145deg, rgba(26, 31, 46, 0.9) 0%, rgba(17, 24, 39, 0.6) 50%, rgba(15, 23, 42, 0.3) 100%)',
            border: '1px solid rgba(55, 65, 81, 0.6)',
            borderRadius: '0.8rem',
            padding: '1.2rem',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: '600',
              marginBottom: '1.2rem',
              color: '#ffffff'
            }}>
              Market Rates
            </h3>
            
            {Object.keys(marketSettings).map(market => (
              <div key={market} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                borderBottom: '1px solid rgba(55, 65, 81, 0.6)',
                marginBottom: '1rem'
              }}>
                <span style={{ color: '#ffffff', fontWeight: '600' }}>{market}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    step="0.001"
                    value={marketSettings[market].apy}
                    onChange={(e) => updateMarketSetting(market, e.target.value)}
                    style={{
                      width: '100px',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '0.6rem',
                      border: '1px solid rgba(75, 85, 99, 0.4)',
                      background: 'rgba(31, 41, 55, 0.8)',
                      color: '#ffffff',
                      textAlign: 'right',
                      fontWeight: '500'
                    }}
                  />
                  <span style={{ color: '#9ca3af', fontWeight: '600' }}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Placeholder tabs */}
      {(activeTab === "Docs" || activeTab === "Leaderboard") && (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          background: 'linear-gradient(145deg, rgba(26, 31, 46, 0.9) 0%, rgba(17, 24, 39, 0.6) 50%, rgba(15, 23, 42, 0.3) 100%)',
          borderRadius: '1.5rem',
          border: '1px solid rgba(55, 65, 81, 0.6)',
          backdropFilter: 'blur(16px)',
          margin: '2rem auto',
          maxWidth: '800px'
        }}>
          <div style={{ fontSize: '5rem', marginBottom: '2rem', opacity: 0.6 }}>
            {activeTab === "Docs" ? "📖" : "🏆"}
          </div>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: '800',
            marginBottom: '1.5rem',
            background: 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {activeTab === "Docs" ? "Documentation Hub" : "Betting Leaderboard"}
          </h2>
          <p style={{
            fontSize: '1.25rem',
            color: '#9ca3af',
            lineHeight: 1.6,
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            {activeTab === "Docs" ? 
              "Complete betting rules and platform documentation" : 
              "Top performers and betting statistics"
            } coming soon...
          </p>
        </div>
      )}

      {/* Enhanced Bet Confirmation Modal */}
      {pendingBet && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(26, 31, 46, 0.9) 0%, rgba(17, 24, 39, 0.6) 50%, rgba(15, 23, 42, 0.3) 100%)',
            border: '1px solid rgba(55, 65, 81, 0.6)',
            borderRadius: '1rem',
            padding: '1.5rem',
            maxWidth: '28rem',
            width: '100%',
            margin: '0 1rem',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 64px rgba(0, 0, 0, 0.4)'
          }}>
            <h3 style={{
              fontSize: '1.3rem',
              fontWeight: '700',
              marginBottom: '1.2rem',
              color: '#ffffff'
            }}>
              Confirm Your {pendingBet.mode === 'house' ? 'House' : 'P2P'} Bet
            </h3>
            
            <div style={{
              background: pendingBet.direction === 'higher' ? 
                'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.1) 100%)' :
                'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
              border: pendingBet.direction === 'higher' ? 
                '1px solid rgba(34, 197, 94, 0.3)' : 
                '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '1rem',
              padding: '2rem',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '0.875rem',
                color: '#9ca3af',
                marginBottom: '0.5rem',
                textTransform: 'uppercase'
              }}>
                {pendingBet.mode === 'house' ? 'House Betting' : 'P2P Order'} - {pendingBet.direction}
              </div>
              
              <div style={{
                fontSize: '2.5rem',
                fontWeight: '800',
                color: pendingBet.direction === 'higher' ? '#22c55e' : '#ef4444',
                marginBottom: '0.5rem'
              }}>
                {pendingBet.executionPrice}%
              </div>
              
              <div style={{ fontSize: '1rem', color: '#6b7280' }}>
                {pendingBet.mode === 'house' ? 'Execution Price' : 'Order Price'}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                background: 'rgba(17, 24, 39, 0.8)',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid #374151'
              }}>
                <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Bet Amount
                </div>
                <div style={{ color: '#f1f5f9', fontSize: '1.25rem', fontWeight: '700' }}>
                  ${pendingBet.amount.toLocaleString()}
                </div>
              </div>
              
              <div style={{
                background: 'rgba(17, 24, 39, 0.8)',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid #374151'
              }}>
                <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Potential Win
                </div>
                <div style={{ color: '#22c55e', fontSize: '1.25rem', fontWeight: '700' }}>
                  ${pendingBet.potentialWin}
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(55, 65, 81, 0.3)',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                Market: {pendingBet.market}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                Mode: {pendingBet.mode === 'house' ? 'Instant execution against house' : 'Create order for other users to fill'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button 
                onClick={confirmBet} 
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)',
                  color: 'white',
                  padding: '0.8rem',
                  borderRadius: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  border: 'none',
                  flex: 1,
                  textTransform: 'uppercase'
                }}
              >
                {pendingBet.mode === 'house' ? 'Execute Bet' : 'Create Order'}
              </button>
              <button 
                onClick={() => setPendingBet(null)} 
                style={{
                  background: 'rgba(55, 65, 81, 0.6)',
                  color: 'white',
                  padding: '0.8rem',
                  borderRadius: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  flex: 1
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Confirmation Modal */}
      {pendingSettlement && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(26, 31, 46, 0.9) 0%, rgba(17, 24, 39, 0.6) 50%, rgba(15, 23, 42, 0.3) 100%)',
            border: '1px solid rgba(55, 65, 81, 0.6)',
            borderRadius: '1rem',
            padding: '1.5rem',
            maxWidth: '28rem',
            width: '100%',
            margin: '0 1rem',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 64px rgba(0, 0, 0, 0.4)'
          }}>
            <h3 style={{
              fontSize: '1.3rem',
              fontWeight: '700',
              marginBottom: '1rem',
              color: '#ffffff'
            }}>
              Confirm Settlement
            </h3>
            <div style={{ marginBottom: '1rem', color: '#9ca3af', fontSize: '0.875rem' }}>
              This will settle all active bets using these final rates:
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              {Object.keys(pendingSettlement.prices).map(market => (
                <div key={market} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid rgba(55, 65, 81, 0.3)'
                }}>
                  <span>{market}:</span>
                  <span style={{ fontWeight: '600' }}>
                    {pendingSettlement.prices[market].toFixed(3)}%
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={confirmSettlement} style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 35%, #34d399 70%, #6ee7b7 100%)',
                color: 'white',
                padding: '1rem 1.5rem',
                borderRadius: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                border: 'none',
                flex: 1
              }}>
                Settle All Bets
              </button>
              <button onClick={() => setPendingSettlement(null)} style={{
                background: 'rgba(55, 65, 81, 0.6)',
                color: 'white',
                padding: '1rem 1.5rem',
                borderRadius: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                border: '1px solid rgba(75, 85, 99, 0.5)',
                flex: 1
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes meshFloat {
          0%, 100% { 
            transform: rotate(0deg) scale(1) translate(0, 0); 
            opacity: 0.8;
          }
          25% { 
            transform: rotate(90deg) scale(1.1) translate(2%, 1%); 
            opacity: 1;
          }
          50% { 
            transform: rotate(180deg) scale(0.9) translate(-1%, 2%); 
            opacity: 0.9;
          }
          75% { 
            transform: rotate(270deg) scale(1.05) translate(1%, -1%); 
            opacity: 0.95;
          }
        }

        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
