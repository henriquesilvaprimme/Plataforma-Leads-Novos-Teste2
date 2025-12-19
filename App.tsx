
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { LeadList } from './components/LeadList';
import { RenewalList } from './components/RenewalList';
import { RenewedList } from './components/RenewedList';
import { InsuredList } from './components/InsuredList';
import { UserList } from './components/UserList';
import { Ranking } from './components/Ranking';
import { Reports } from './components/Reports';
import { Login } from './components/Login';
import { LostRenewalList } from './components/LostRenewalList'; // Imported
import { Lead, LeadStatus, User } from './types';
import { LayoutDashboard, Users, RefreshCw, CheckCircle, FileText, UserCog, Trophy, Power, FileBarChart2, FileX } from './components/Icons'; // Imported FileX
import { 
  subscribeToCollection, 
  subscribeToRenovationsTotal, 
  addDataToCollection, 
  updateDataInCollection, 
  updateTotalRenovacoes, 
  isFirebaseConfigured 
} from './services/firebase';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  
  // COLEÇÕES DO FIREBASE
  const [leadsCollection, setLeadsCollection] = useState<Lead[]>([]); 
  const [renewalsCollection, setRenewalsCollection] = useState<Lead[]>([]); 
  const [renewedCollection, setRenewedCollection] = useState<Lead[]>([]); 
  const [usersCollection, setUsersCollection] = useState<User[]>([]); 
  
  // STATS
  const [manualRenewalTotal, setManualRenewalTotal] = useState<number>(0);

  // USUÁRIO ATUAL - Persistência no SessionStorage (F5 ok, Fechar aba = Logout)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
      const savedUser = sessionStorage.getItem('currentUser');
      return savedUser ? JSON.parse(savedUser) : null;
  });

  // Salvar usuário no sessionStorage sempre que mudar
  useEffect(() => {
      if (currentUser) {
          sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
      } else {
          sessionStorage.removeItem('currentUser');
      }
  }, [currentUser]);

  // === FIREBASE SUBSCRIPTIONS ===
  useEffect(() => {
    const unsubscribeLeads = subscribeToCollection('leads', (data) => setLeadsCollection(data as Lead[]));
    const unsubscribeRenewals = subscribeToCollection('renovacoes', (data) => setRenewalsCollection(data as Lead[]));
    const unsubscribeRenewed = subscribeToCollection('renovados', (data) => {
        const fixedData = data.map(d => ({ ...d, status: LeadStatus.CLOSED }));
        setRenewedCollection(fixedData as Lead[]);
    });
    const unsubscribeUsers = subscribeToCollection('usuarios', (data) => setUsersCollection(data as User[]));
    const unsubscribeTotal = subscribeToRenovationsTotal((total) => setManualRenewalTotal(total));

    return () => {
        unsubscribeLeads();
        unsubscribeRenewals();
        unsubscribeRenewed();
        unsubscribeUsers();
        unsubscribeTotal();
    };
  }, []);

  // === HANDLERS ===
  const handleAddLead = (newLead: Lead) => {
    if (newLead.id.includes('renewed')) {
        addDataToCollection('renovados', newLead);
    } else if (newLead.id.includes('renewal_copy')) {
        addDataToCollection('renovacoes', newLead);
    } else if ((newLead.insuranceType === 'Renovação' || newLead.insuranceType === 'Renovação Primme') && currentPath.includes('renovacoes')) {
        addDataToCollection('renovacoes', newLead);
    } else {
        addDataToCollection('leads', newLead);
    }
  };

  const handleUpdateLead = (updatedLead: Lead) => {
      if (currentPath.includes('leads')) {
          updateDataInCollection('leads', updatedLead.id, updatedLead);
      } else if (currentPath.includes('renovacoes') || currentPath.includes('renovacoes-perdidas') || currentPath.includes('segurados')) {
          updateDataInCollection('renovacoes', updatedLead.id, updatedLead);
      } else if (currentPath.includes('renovados')) {
          updateDataInCollection('renovados', updatedLead.id, updatedLead);
      } else if (currentPath.includes('relatorios')) {
          // No relatório, verificamos em qual coleção o lead originalmente reside
          if (leadsCollection.find(l => l.id === updatedLead.id)) updateDataInCollection('leads', updatedLead.id, updatedLead);
          else if (renewedCollection.find(l => l.id === updatedLead.id)) updateDataInCollection('renovados', updatedLead.id, updatedLead);
          else if (renewalsCollection.find(l => l.id === updatedLead.id)) updateDataInCollection('renovacoes', updatedLead.id, updatedLead);
      } else {
          if (leadsCollection.find(l => l.id === updatedLead.id)) updateDataInCollection('leads', updatedLead.id, updatedLead);
          else if (renewalsCollection.find(l => l.id === updatedLead.id)) updateDataInCollection('renovacoes', updatedLead.id, updatedLead);
          else if (renewedCollection.find(l => l.id === updatedLead.id)) updateDataInCollection('renovados', updatedLead.id, updatedLead);
      }
  };

  const handleUpdateUser = (updatedUser: User) => updateDataInCollection('usuarios', updatedUser.id, updatedUser);
  const handleAddUser = (newUser: User) => addDataToCollection('usuarios', newUser);
  const handleUpdateRenovationsTotal = (val: number) => updateTotalRenovacoes(val);

  const allLeadsForRanking = [...leadsCollection, ...renewalsCollection, ...renewedCollection];

  // === PERMISSIONS LOGIC ===
  const isAdmin = currentUser?.isAdmin;
  const isRenovations = !isAdmin && currentUser?.isRenovations;
  const isComum = !isAdmin && !isRenovations;

  useEffect(() => {
    if (!currentUser) return;
    
    if (isComum) {
        const allowed = ['/dashboard', '/leads', '/ranking'];
        if (!allowed.some(path => currentPath.startsWith(path)) && currentPath !== '/') {
            navigate('/dashboard');
        }
    }
    if (isRenovations) {
        const allowed = ['/dashboard', '/renovacoes', '/renovacoes-perdidas', '/renovados'];
        if (!allowed.some(path => currentPath.startsWith(path)) && currentPath !== '/') {
            navigate('/dashboard');
        }
    }
  }, [currentPath, isComum, isRenovations, currentUser, navigate]);

  if (!currentUser) {
      return <Login users={usersCollection} onLogin={(user) => {
          setCurrentUser(user);
          navigate('/dashboard');
      }} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
      {!isFirebaseConfigured && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-red-600 text-white text-xs font-bold px-4 py-2 text-center shadow-md">
            ⚠️ ATENÇÃO: Firebase não configurado. Edite o arquivo <code>services/firebase.ts</code> com suas chaves para salvar os dados. (Modo Visualização)
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex pt-8">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="bg-indigo-500 w-8 h-8 rounded-lg flex items-center justify-center">L</span>
            {currentUser?.name || 'Leads AI'}
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {/* DASHBOARD */}
          <button 
            onClick={() => navigate('/dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentPath.startsWith('/dashboard') ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
          
          {/* MEUS LEADS */}
          {(isAdmin || isComum) && (
            <button 
                onClick={() => navigate('/leads')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentPath.startsWith('/leads') ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <Users className="w-5 h-5" />
                <span>Meus Leads</span>
            </button>
          )}

          {/* RENOVAÇÕES */}
          {(isAdmin || isRenovations) && (
            <>
                <button 
                    onClick={() => navigate('/renovacoes')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentPath === '/renovacoes' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    <RefreshCw className="w-5 h-5" />
                    <span>Renovações</span>
                </button>

                <button 
                    onClick={() => navigate('/renovacoes-perdidas')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentPath === '/renovacoes-perdidas' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    <FileX className="w-5 h-5" />
                    <span>Perdidas</span>
                </button>
            </>
          )}

          {/* RENOVADOS */}
          {(isAdmin || isRenovations) && (
            <button 
                onClick={() => navigate('/renovados')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentPath.startsWith('/renovados') ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <CheckCircle className="w-5 h-5" />
                <span>Renovados</span>
            </button>
          )}

          {/* SEGURADOS */}
          {isAdmin && (
            <button 
                onClick={() => navigate('/segurados')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentPath.startsWith('/segurados') ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <FileText className="w-5 h-5" />
                <span>Segurados</span>
            </button>
          )}

          {/* RANKING */}
          {(isAdmin || isComum) && (
            <button 
                onClick={() => navigate('/ranking')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentPath.startsWith('/ranking') ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <Trophy className="w-5 h-5" />
                <span>Ranking</span>
            </button>
          )}

           {/* RELATÓRIOS */}
           {isAdmin && (
            <button 
                onClick={() => navigate('/relatorios')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentPath.startsWith('/relatorios') ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <FileBarChart2 className="w-5 h-5" />
                <span>Relatórios</span>
            </button>
          )}

          {/* USUÁRIOS */}
          {isAdmin && (
            <button 
                onClick={() => navigate('/usuarios')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentPath.startsWith('/usuarios') ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <UserCog className="w-5 h-5" />
                <span>Usuários</span>
            </button>
          )}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${currentUser?.avatarColor || 'bg-indigo-600'}`}>
              {(currentUser?.name || 'U').charAt(0)}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-medium truncate">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">
                  {currentUser?.isAdmin ? 'Administrador' : currentUser?.isRenovations ? 'Renovações' : 'Comum'}
              </p>
            </div>
            <button 
                onClick={() => {
                    setCurrentUser(null);
                    sessionStorage.removeItem('currentUser');
                    navigate('/');
                }} 
                className="text-slate-400 hover:text-white"
                title="Sair"
            >
                <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative pt-6">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 md:hidden">
            <h1 className="font-bold text-gray-800">Leads AI</h1>
            <button onClick={() => { setCurrentUser(null); navigate('/'); }} className="text-red-500 text-sm font-bold">Sair</button>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-8 relative bg-gray-100">
            <Routes>
                <Route path="/dashboard" element={
                    <Dashboard 
                        newLeadsData={leadsCollection}
                        renewalLeadsData={[...renewalsCollection, ...renewedCollection]} 
                        manualRenewalTotal={manualRenewalTotal}
                        onUpdateRenewalTotal={handleUpdateRenovationsTotal}
                        currentUser={currentUser}
                    />
                } />
                
                <Route path="/leads" element={
                    (isAdmin || isComum) ? (
                        <div className="h-full">
                            <LeadList 
                                leads={leadsCollection} 
                                users={usersCollection}
                                onSelectLead={() => {}}
                                onUpdateLead={handleUpdateLead}
                                onAddLead={handleAddLead}
                                currentUser={currentUser}
                            />
                        </div>
                    ) : <Navigate to="/dashboard" />
                } />

                <Route path="/renovacoes" element={
                    (isAdmin || isRenovations) ? (
                        <div className="h-full">
                            <RenewalList 
                                leads={renewalsCollection} 
                                users={usersCollection}
                                onUpdateLead={handleUpdateLead} 
                                onAddLead={handleAddLead} 
                                currentUser={currentUser}
                            />
                        </div>
                    ) : <Navigate to="/dashboard" />
                } />

                <Route path="/renovacoes-perdidas" element={
                    (isAdmin || isRenovations) ? (
                        <div className="h-full">
                            <LostRenewalList 
                                leads={renewalsCollection} 
                                users={usersCollection}
                                onUpdateLead={handleUpdateLead} 
                                currentUser={currentUser}
                            />
                        </div>
                    ) : <Navigate to="/dashboard" />
                } />

                <Route path="/renovados" element={
                    (isAdmin || isRenovations) ? (
                        <div className="h-full">
                            <RenewedList 
                                leads={renewedCollection} 
                                onUpdateLead={handleUpdateLead} 
                                currentUser={currentUser}
                            />
                        </div>
                    ) : <Navigate to="/dashboard" />
                } />

                <Route path="/segurados" element={
                    isAdmin ? (
                        <div className="h-full">
                            <InsuredList 
                                leads={renewalsCollection} 
                                onUpdateLead={handleUpdateLead} 
                            />
                        </div>
                    ) : <Navigate to="/dashboard" />
                } />

                <Route path="/ranking" element={
                    (isAdmin || isComum) ? (
                        <div className="h-full">
                            <Ranking leads={allLeadsForRanking} users={usersCollection} />
                        </div>
                    ) : <Navigate to="/dashboard" />
                } />

                <Route path="/relatorios" element={
                    isAdmin ? (
                        <div className="h-full">
                            <Reports 
                              leads={leadsCollection} 
                              renewed={renewedCollection} 
                              renewals={renewalsCollection} 
                              onUpdateLead={handleUpdateLead}
                            />
                        </div>
                    ) : <Navigate to="/dashboard" />
                } />

                <Route path="/usuarios" element={
                    isAdmin ? (
                        <div className="h-full">
                            <UserList 
                                users={usersCollection} 
                                onUpdateUser={handleUpdateUser} 
                                onAddUser={handleAddUser} 
                            />
                        </div>
                    ) : <Navigate to="/dashboard" />
                } />

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </div>
      </main>
    </div>
  );
}
