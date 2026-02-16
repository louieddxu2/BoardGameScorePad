
import { useState, useEffect, useCallback, useRef } from 'react';
import { GameOption } from '../types';
import { ScoringRule } from '../../../types';
import { recommendationService } from '../../recommendation/RecommendationService';

// 定義鎖定狀態介面
interface FieldLocks {
    game: boolean; // 其實不太需要，因為遊戲總是當下的選擇
    location: boolean;
    count: boolean;
}

export const useRecommendedGameSetup = (activeGame: GameOption | null) => {
  // --- Core State ---
  const [playerCount, setPlayerCountState] = useState(4);
  const [location, setLocationState] = useState('');
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [scoringRule, setScoringRule] = useState<ScoringRule>('HIGHEST_WINS');
  const [startTimeStr, setStartTimeStr] = useState('');

  // --- Lock State (User Intent Tracking) ---
  const [locks, setLocks] = useState<FieldLocks>({
      game: false,     
      location: false,
      count: false
  });

  // Refs for logic control
  const prevGameIdRef = useRef<string | null>(null);
  const isColdStartRef = useRef(true); 

  // 1. Initialize Time (Once)
  useEffect(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setStartTimeStr(`${hours}:${minutes}`);
  }, []);

  // =================================================================
  // 單元推薦邏輯 (Unit Recommendation Helpers)
  // =================================================================

  const recommendLocation = async (gameName?: string, bggId?: string, currentCount?: number): Promise<string | null> => {
      try {
          const suggestions = await recommendationService.getSuggestedLocations({
              gameName, bggId,
              playerCount: currentCount,
              timestamp: Date.now()
          });
          return suggestions.length > 0 ? suggestions[0] : null;
      } catch (e) { console.warn("Loc Rec failed", e); return null; }
  };

  const recommendCount = async (gameName?: string, bggId?: string, currentLocationName?: string): Promise<number | null> => {
      try {
          const suggestions = await recommendationService.getSuggestedPlayerCounts({
              gameName, bggId,
              locationName: currentLocationName,
              timestamp: Date.now()
          });
          return suggestions.length > 0 ? suggestions[0] : null;
      } catch (e) { console.warn("Count Rec failed", e); return null; }
  };

  const recommendGame = async (locationName?: string, currentCount?: number): Promise<string | null> => {
      try {
          // [Future Implementation]
          // const suggestions = await recommendationService.getSuggestedGames({
          //    locationName, playerCount: currentCount, timestamp: Date.now()
          // });
          // return suggestions.length > 0 ? suggestions[0] : null;
          return null; 
      } catch (e) { console.warn("Game Rec failed", e); return null; }
  };

  // =================================================================
  // 完整流程定義 (Explicit Flows)
  // =================================================================

  /**
   * Flow 1: 冷處理 (Cold Start)
   * 順序: 環境 -> 地點 -> 遊戲 -> 人數
   */
  const flowColdStart = async () => {
      // 1. 推測地點 (Based on Time/Context)
      let nextLoc = await recommendLocation(undefined, undefined, undefined);
      
      if (nextLoc) {
          setLocationState(nextLoc);
          setLocationId(undefined);
      } else {
          nextLoc = location; // Keep existing if no suggestion
      }

      // 2. 推測遊戲 (Based on Location + Time) - [Future]
      // const nextGameId = await recommendGame(nextLoc, undefined);
      // if (nextGameId) { onSwitchGame(nextGameId); } 
      // 目前因為 activeGame 是由上層傳入，這裡無法直接切換遊戲，僅保留邏輯位置。
      const currentGame = activeGame; 

      // 3. 推測人數 (Based on Game + Location)
      if (currentGame) {
          const nextCount = await recommendCount(currentGame.displayName, currentGame.bggId, nextLoc);
          if (nextCount) setPlayerCountState(nextCount);
      }
      
      // Mark as handled
      isColdStartRef.current = false;
  };

  /**
   * Flow 2: 鎖定遊戲 (Lock Game)
   * 觸發: 使用者手動切換遊戲
   * 順序: 遊戲 -> 地點 -> 人數
   */
  const flowGameLocked = async (game: GameOption) => {
      // 0. Update Rules (Immediate side-effect of game)
      if (game.defaultScoringRule) {
          setScoringRule(game.defaultScoringRule as ScoringRule);
      } else {
          setScoringRule('HIGHEST_WINS');
      }

      let nextLoc = location;

      // 1. 推測地點 (若未鎖定)
      if (!locks.location) {
          const suggestedLoc = await recommendLocation(game.displayName, game.bggId, undefined);
          if (suggestedLoc) {
              nextLoc = suggestedLoc;
              setLocationState(nextLoc);
              setLocationId(undefined);
          }
      }

      // 2. 推測人數 (若未鎖定)
      if (!locks.count) {
          const suggestedCount = await recommendCount(game.displayName, game.bggId, nextLoc);
          if (suggestedCount) {
              setPlayerCountState(suggestedCount);
          }
      }
  };

  /**
   * Flow 3: 鎖定地點 (Lock Location)
   * 觸發: 使用者手動輸入/選擇地點
   * 順序: 地點 -> 遊戲 -> 人數
   */
  const flowLocationLocked = async (newLocation: string, newLocationId?: string) => {
      // 0. Update State & Lock
      setLocationState(newLocation);
      setLocationId(newLocationId);
      
      // Update Locks locally for this flow context
      const currentLocks = { ...locks, location: true }; 
      setLocks(currentLocks); // Persist lock

      // 1. 推測遊戲 (若未鎖定 - 雖然目前 UI 很難鎖定遊戲以外的狀態) - [Future]
      // const nextGameId = await recommendGame(newLocation, undefined);
      // if (nextGameId && !currentLocks.game) { ... }
      const currentGame = activeGame;

      // 2. 推測人數 (若未鎖定)
      if (!currentLocks.count && currentGame) {
          const suggestedCount = await recommendCount(currentGame.displayName, currentGame.bggId, newLocation);
          if (suggestedCount) {
              setPlayerCountState(suggestedCount);
          }
      }
  };

  /**
   * Flow 4: 鎖定人數 (Lock Count)
   * 觸發: 使用者手動調整人數
   * 順序: 人數 -> 遊戲 -> 地點
   */
  const flowCountLocked = async (newCount: number) => {
      // 0. Update State & Lock
      setPlayerCountState(newCount);
      
      // Update Locks locally
      const currentLocks = { ...locks, count: true };
      setLocks(currentLocks); // Persist lock

      // 1. 推測遊戲 (若未鎖定) - [Future]
      // const nextGameId = await recommendGame(location, newCount);
      const currentGame = activeGame;

      // 2. 推測地點 (若未鎖定)
      if (!currentLocks.location) {
          // 注意：這裡我們不傳入 Game，或者視策略而定。
          // 根據您的需求 "鎖定人數：遊戲、地點"，應該是根據人數推測遊戲，再根據人數+遊戲推測地點。
          const suggestedLoc = await recommendLocation(
              currentGame?.displayName, 
              currentGame?.bggId, 
              newCount
          );
          if (suggestedLoc) {
              setLocationState(suggestedLoc);
              setLocationId(undefined);
          }
      }
  };

  // =================================================================
  // 事件監聽 (Event Listeners)
  // =================================================================

  // Trigger: Game Changed OR Cold Start
  useEffect(() => {
      if (!activeGame) return;
      
      const isGameSwitch = prevGameIdRef.current !== activeGame.uid;
      
      if (isColdStartRef.current) {
          flowColdStart();
      } else if (isGameSwitch) {
          flowGameLocked(activeGame);
      }
      
      prevGameIdRef.current = activeGame.uid;
  }, [activeGame, locks.location, locks.count, location]); // Dependencies ensure we access latest state

  // Trigger Wrappers
  const handleManualLocationChange = (val: string, id?: string) => {
      flowLocationLocked(val, id);
  };

  const handleManualCountChange = (val: number | ((prev: number) => number)) => {
      const nextVal = typeof val === 'function' ? val(playerCount) : val;
      flowCountLocked(nextVal);
  };

  return {
      playerCount, 
      setPlayerCount: handleManualCountChange,
      isPlayerCountManual: locks.count,
      
      location, 
      setLocation: handleManualLocationChange,
      isLocationManual: locks.location,
      
      locationId, setLocationId,
      scoringRule, setScoringRule,
      startTimeStr, setStartTimeStr
  };
};
