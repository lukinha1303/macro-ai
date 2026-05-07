/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Utensils, Zap, Info, ChevronRight, Loader2, AlertCircle, UtensilsCrossed, History, User, Save, Settings, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeMealImage, AnalysisResult, FoodItem } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type View = 'scan' | 'diary' | 'profile' | 'history';

interface MealRecord {
  id: number;
  image_url: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  summary: string;
  items: FoodItem[];
  created_at: string;
}

interface WeightEntry {
  id: number;
  weight: number;
  created_at: string;
}

interface UserProfile {
  name: string;
  goal_calories: number;
  weight: number;
  height: number;
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('scan');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  // Diary State
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [isLoadingMeals, setIsLoadingMeals] = useState(false);

  // Profile State
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Usuário',
    goal_calories: 2000,
    weight: 70,
    height: 170
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<UserProfile>(profile);

  // History State
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (currentView === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }
    
    if (currentView === 'diary') {
      fetchMeals();
    }
    
    if (currentView === 'profile') {
      fetchProfile();
    }

    if (currentView === 'history') {
      fetchWeightHistory();
    }
  }, [currentView]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraReady(false);
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraReady(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const fetchMeals = async () => {
    setIsLoadingMeals(true);
    try {
      const res = await fetch('/api/meals');
      const data = await res.json();
      setMeals(data);
    } catch (err) {
      console.error("Failed to fetch meals:", err);
    } finally {
      setIsLoadingMeals(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      setProfile(data);
      setEditForm(data);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
  };

  const fetchWeightHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/weight-history');
      const data = await res.json();
      setWeightHistory(data);
    } catch (err) {
      console.error("Failed to fetch weight history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const updateProfile = async (newProfile: UserProfile) => {
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile)
      });
      setProfile(newProfile);
      setIsEditingProfile(false);
    } catch (err) {
      console.error("Failed to update profile:", err);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(base64);
        handleAnalysis(base64.split(',')[1]);
      }
    }
  };

  const handleAnalysis = async (base64: string) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const data = await analyzeMealImage(base64);
      setResult(data);
      
      // Save to DB
      await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: `data:image/jpeg;base64,${base64}`,
          ...data
        })
      });
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Falha ao analisar a imagem. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-900/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black border border-white/20 rounded-xl flex items-center justify-center text-emerald-500 shadow-inner">
            <UtensilsCrossed size={22} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Macro AI</h1>
        </div>
        <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <Info size={20} className="text-white/40" />
        </button>
      </header>

      <main className="pt-24 pb-28 px-4 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {currentView === 'scan' && (
            <motion.div
              key="scan-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {!capturedImage ? (
                <motion.div
                  key="camera"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative aspect-[3/4] bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10"
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-white/20 rounded-full border-dashed animate-[spin_20s_linear_infinite]" />
                    <div className="absolute w-full h-full border-[30px] border-black/40" />
                  </div>

                  <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-auto">
                    <button
                      onClick={captureImage}
                      disabled={!isCameraReady}
                      className={cn(
                        "w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center transition-transform active:scale-90",
                        !isCameraReady && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="w-16 h-16 bg-white rounded-full shadow-lg" />
                    </button>
                  </div>

                  {error && (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center">
                      <AlertCircle className="text-red-500 mb-4" size={48} />
                      <p className="text-white font-medium mb-6">{error}</p>
                      <button
                        onClick={startCamera}
                        className="px-6 py-3 bg-emerald-500 text-black rounded-full font-bold flex items-center gap-2"
                      >
                        <RefreshCw size={18} />
                        Tentar Novamente
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                    <img src={capturedImage} alt="Refeição capturada" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center text-white">
                        <div className="relative mb-6">
                          <Loader2 className="animate-spin text-emerald-500" size={48} />
                          <div className="absolute inset-0 animate-pulse bg-emerald-500/20 rounded-full blur-xl" />
                        </div>
                        <p className="font-black tracking-[0.2em] text-sm uppercase animate-pulse text-emerald-400">Analisando imagem...</p>
                        <p className="text-[10px] text-white/40 mt-2 uppercase tracking-widest">Identificando alimentos e porções</p>
                      </div>
                    )}
                  </div>

                  {result && (
                    <div className="space-y-6">
                      <div className="bg-zinc-900/50 backdrop-blur-sm rounded-3xl p-6 border border-white/10 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <UtensilsCrossed size={80} />
                        </div>
                        
                        <div className="flex justify-between items-end mb-8 relative z-10">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Total da Refeição</p>
                            <div className="flex items-baseline gap-2">
                              <h2 className="text-6xl font-black tracking-tighter text-emerald-400">{result.totalCalories}</h2>
                              <span className="text-xl font-bold text-emerald-500/40 uppercase">kcal</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-2">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Análise Concluída</span>
                            </div>
                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Precisão Estimada</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 relative z-10">
                          <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10 flex flex-col items-center">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/40 mb-1">Proteína</p>
                            <p className="text-xl font-black text-white">{result.totalProtein}<span className="text-[10px] ml-0.5 text-white/40">g</span></p>
                          </div>
                          <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10 flex flex-col items-center">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/40 mb-1">Carbos</p>
                            <p className="text-xl font-black text-white">{result.totalCarbs}<span className="text-[10px] ml-0.5 text-white/40">g</span></p>
                          </div>
                          <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10 flex flex-col items-center">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/40 mb-1">Gordura</p>
                            <p className="text-xl font-black text-white">{result.totalFat}<span className="text-[10px] ml-0.5 text-white/40">g</span></p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-2">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Alimentos Detectados</h3>
                          <span className="text-[9px] font-bold text-white/20 uppercase">Peso & Confiança</span>
                        </div>
                        {result.items.map((item, idx) => (
                          <div key={idx} className="bg-zinc-900/80 rounded-2xl p-4 flex items-center justify-between border border-white/5 group hover:border-emerald-500/30 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-emerald-500/5 rounded-xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500/10 transition-colors">
                                {item.name.toLowerCase().includes('arroz') ? <Utensils size={24} /> : 
                                 item.name.toLowerCase().includes('carne') ? <Zap size={24} /> : 
                                 item.name.toLowerCase().includes('feijão') ? <Info size={24} /> : 
                                 <Utensils size={24} />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-black text-white tracking-tight">{item.name}</p>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/5 rounded text-white/40">{item.grams}g</span>
                                </div>
                                <p className="text-xs text-white/40">{item.portion}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-emerald-400">{item.calories} kcal</p>
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-500" 
                                    style={{ width: `${item.confidence}%` }} 
                                  />
                                </div>
                                <span className="text-[8px] font-black text-white/20">{item.confidence}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-emerald-500 rounded-3xl p-6 shadow-2xl shadow-emerald-500/20 relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 text-black/5 rotate-12 group-hover:scale-110 transition-transform">
                          <Zap size={120} />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-3">
                            <Zap size={16} fill="black" className="text-black" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-black/60">Análise Nutricional</p>
                          </div>
                          <p className="text-black font-black text-lg leading-tight">{result.summary}</p>
                        </div>
                      </div>

                      <div className="pt-4">
                        <button
                          onClick={reset}
                          className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-transform hover:bg-emerald-50"
                        >
                          <RefreshCw size={20} />
                          Nova Refeição
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {currentView === 'diary' && (
            <motion.div
              key="diary-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center px-2">
                <h2 className="text-2xl font-bold tracking-tight">Seu Diário</h2>
                <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                  {meals.length} Refeições
                </div>
              </div>

              {isLoadingMeals ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/20">
                  <Loader2 className="animate-spin mb-4" size={32} />
                  <p className="text-xs font-bold uppercase tracking-widest">Carregando histórico...</p>
                </div>
              ) : meals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/20 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                  <History size={48} className="mb-4 opacity-50" />
                  <p className="text-sm font-bold uppercase tracking-widest">Nenhuma refeição ainda</p>
                  <button onClick={() => setCurrentView('scan')} className="mt-4 text-emerald-500 text-xs font-black uppercase tracking-widest underline underline-offset-4">Começar a escanear</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {meals.map((meal) => (
                    <div key={meal.id} className="bg-zinc-900/50 rounded-3xl overflow-hidden border border-white/5 shadow-lg">
                      <div className="flex p-4 gap-4">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-white/10">
                          <img src={meal.image_url} alt="Meal" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">
                              {new Date(meal.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <h4 className="font-bold text-lg leading-tight text-emerald-400">{meal.total_calories} kcal</h4>
                          </div>
                          <div className="flex gap-3">
                            <div className="text-center">
                              <p className="text-[8px] font-black uppercase text-white/20">P</p>
                              <p className="text-xs font-bold">{meal.total_protein}g</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[8px] font-black uppercase text-white/20">C</p>
                              <p className="text-xs font-bold">{meal.total_carbs}g</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[8px] font-black uppercase text-white/20">G</p>
                              <p className="text-xs font-bold">{meal.total_fat}g</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {currentView === 'profile' && (
            <motion.div
              key="profile-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-black shadow-2xl shadow-emerald-500/20">
                    <User size={48} />
                  </div>
                  <button 
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className={cn(
                      "absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-black transition-colors",
                      isEditingProfile ? "bg-emerald-400 text-black" : "bg-white text-black"
                    )}
                  >
                    <Settings size={16} />
                  </button>
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{profile.name}</h2>
                  <p className="text-xs font-black uppercase tracking-widest text-white/30">Membro Premium</p>
                </div>
              </div>

              {isEditingProfile ? (
                <div className="bg-zinc-900/80 p-6 rounded-3xl border border-emerald-500/30 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Meta de Calorias (kcal)</label>
                    <input 
                      type="number" 
                      value={editForm.goal_calories}
                      onChange={(e) => setEditForm({...editForm, goal_calories: Number(e.target.value)})}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Peso Atual (kg)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={editForm.weight}
                      onChange={(e) => setEditForm({...editForm, weight: Number(e.target.value)})}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 font-bold text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <button 
                    onClick={() => updateProfile(editForm)}
                    className="w-full py-4 bg-emerald-500 text-black rounded-xl font-black uppercase tracking-widest text-sm shadow-lg shadow-emerald-500/20"
                  >
                    Salvar Alterações
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Meta Diária</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-emerald-400">{profile.goal_calories}</span>
                      <span className="text-[10px] font-bold text-white/20 uppercase">kcal</span>
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Peso Atual</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-white">{profile.weight}</span>
                      <span className="text-[10px] font-bold text-white/20 uppercase">kg</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-2">Análise & Progresso</h3>
                <div className="bg-zinc-900/50 rounded-3xl overflow-hidden border border-white/5">
                  <button 
                    onClick={() => setCurrentView('history')}
                    className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-emerald-500">
                        <History size={20} />
                      </div>
                      <span className="font-bold text-sm">Histórico de Peso</span>
                    </div>
                    <ChevronRight size={16} className="text-white/20" />
                  </button>
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/40">
                        <Save size={20} />
                      </div>
                      <span className="font-bold text-sm">Editar Perfil</span>
                    </div>
                    <ChevronRight size={16} className="text-white/20" />
                  </button>
                  <button className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors text-red-400 text-left">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                        <LogOut size={20} />
                      </div>
                      <span className="font-bold text-sm">Sair da Conta</span>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'history' && (
            <motion.div
              key="history-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setCurrentView('profile')}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <ChevronRight className="rotate-180" size={24} />
                </button>
                <h2 className="text-2xl font-bold tracking-tight">Histórico de Peso</h2>
              </div>

              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/20">
                  <Loader2 className="animate-spin mb-4" size={32} />
                  <p className="text-xs font-bold uppercase tracking-widest">Carregando evolução...</p>
                </div>
              ) : weightHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/20 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                  <p className="text-sm font-bold uppercase tracking-widest">Ainda não há dados</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Card */}
                  <div className="bg-emerald-500 rounded-3xl p-6 shadow-2xl shadow-emerald-500/20">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-1">Evolução Total</p>
                        <h3 className="text-4xl font-black text-black">
                          {(() => {
                            const diff = weightHistory[weightHistory.length - 1].weight - weightHistory[0].weight;
                            return `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg`;
                          })()}
                        </h3>
                      </div>
                      <div className="bg-black/10 px-3 py-1 rounded-full text-[10px] font-black uppercase text-black/40">
                        {weightHistory.length} Registros
                      </div>
                    </div>
                    <p className="text-black/80 text-xs font-bold leading-relaxed">
                      {(() => {
                        const diff = weightHistory[weightHistory.length - 1].weight - weightHistory[0].weight;
                        if (diff < 0) return "Excelente progresso! Você está reduzindo seu peso de forma consistente.";
                        if (diff > 0) return "Você teve um ganho de massa/peso. Continue monitorando seus macros.";
                        return "Seu peso está estável. Mantenha o foco nos seus objetivos!";
                      })()}
                    </p>
                  </div>

                  {/* Weight List */}
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-2">Registros Cronológicos</h3>
                    <div className="space-y-2">
                    {weightHistory.slice().reverse().map((entry, idx, arr) => {
                      const prevEntry = arr[idx + 1];
                      const diff = prevEntry ? entry.weight - prevEntry.weight : 0;
                      
                      return (
                        <div key={entry.id} className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-left">
                              <p className="text-white font-bold">{entry.weight} kg</p>
                              <p className="text-[10px] text-white/20 uppercase font-black">
                                {new Date(entry.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              </p>
                            </div>
                          </div>
                          {idx < arr.length - 1 && (
                            <div className={cn(
                              "px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1",
                              diff < 0 ? "bg-emerald-500/10 text-emerald-500" : diff > 0 ? "bg-red-500/10 text-red-500" : "bg-white/5 text-white/40"
                            )}>
                              {diff === 0 ? "Estável" : `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)} kg`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-white/10 px-8 py-5 flex justify-around items-center">
        <button 
          onClick={() => setCurrentView('scan')}
          className={cn(
            "flex flex-col items-center gap-1.5 transition-colors",
            currentView === 'scan' ? "text-emerald-500" : "text-white/20"
          )}
        >
          <Camera size={26} />
          <span className="text-[9px] font-black uppercase tracking-widest">Escanear</span>
        </button>
        <button 
          onClick={() => setCurrentView('diary')}
          className={cn(
            "flex flex-col items-center gap-1.5 transition-colors",
            currentView === 'diary' ? "text-emerald-500" : "text-white/20"
          )}
        >
          <History size={26} />
          <span className="text-[9px] font-black uppercase tracking-widest">Diário</span>
        </button>
        <button 
          onClick={() => setCurrentView('profile')}
          className={cn(
            "flex flex-col items-center gap-1.5 transition-colors",
            currentView === 'profile' ? "text-emerald-500" : "text-white/20"
          )}
        >
          <User size={26} />
          <span className="text-[9px] font-black uppercase tracking-widest">Perfil</span>
        </button>
      </nav>
    </div>
  );
}
