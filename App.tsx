
import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { LeadList } from './components/LeadList';
import { RenewalList } from './components/RenewalList';
import { RenewedList } from './components/RenewedList';
import { InsuredList } from './components/InsuredList';
import { UserList } from './components/UserList';
import { Ranking } from './components/Ranking';
import { Lead, LeadStatus, User } from './types';
import { LayoutDashboard, Users, RefreshCw, CheckCircle, FileText, UserCog, Trophy } from './components/Icons';
import { subscribeToCollection, subscribeToRenovationsTotal, addDataToCollection, updateDataInCollection, updateTotalRenovacoes } from './services/firebase';

type View = 'dashboard' | 'leads' | 'renewals' | 'renewed' | 'insured' | 'users' | 'ranking';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('leads');
  
  // COLEÇÕES DO FIREBASE
  const [leadsCollection, setLeadsCollection] = useState<Lead[]>([]); // Coleção 'leads'
  const [renewalsCollection, setRenewalsCollection] = useState<Lead[]>([]); // Coleção 'renovacoes'
  const [renewedCollection, setRenewedCollection] = useState<Lead[]>([]); // Coleção 'renovados'
  const [usersCollection, setUsersCollection] = useState<User[]>([]); // Coleção 'usuarios'
  
  // STATS
  const [manualRenewalTotal, setManualRenewalTotal] = useState<number>(0);

  // === FIREBASE SUBSCRIPTIONS ===
  useEffect(() => {
    // 1. Meus Leads
    const unsubscribeLeads = subscribeToCollection('leads', (data) => {
        setLeadsCollection(data as Lead[]);
    });

    // 2. Renovações
    const unsubscribeRenewals = subscribeToCollection('renovacoes', (data) => {
        setRenewalsCollection(data as Lead[]);
    });

    // 3. Renovados
    const unsubscribeRenewed = subscribeToCollection('renovados', (data) => {
        setRenewedCollection(data as Lead[]);
    });

    // 4. Usuários
    const unsubscribeUsers = subscribeToCollection('usuarios', (data) => {
        setUsersCollection(data as User[]);
    });

    // 5. Total Renovações
    const unsubscribeTotal = subscribeToRenovationsTotal((total) => {
        setManualRenewalTotal(total);
    });

    return () => {
        unsubscribeLeads();
        unsubscribeRenewals();
        unsubscribeRenewed();
        unsubscribeUsers();
        unsubscribeTotal();
    };
  }, []);


  // === HANDLERS ===

  // Adicionar Lead (Define a coleção baseada no tipo ou view atual)
  const handleAddLead = (newLead: Lead) => {
    // Se estiver na view de renovações ou o tipo for Renovação, vai para 'renovacoes'
    // Se for 'renovados' (cópia de fechamento), vai para 'renovados'
    
    // Lógica específica para o botão "Novo" na LeadList (Sempre cria em 'leads' a menos que especificado?)
    // O pedido diz: "Meus Leads puxa de leads", "Renovações puxa de renovacoes"
    
    // Se o lead já tem status Fechado e veio de uma cópia (ex: handleSaveDeal no RenewalList),
    // precisamos saber para onde mandar. O RenewalList chamará onAddLead com o objeto cópia.
    
    if (newLead.id.includes('renewed')) {
        // É uma cópia para Renovados
        addDataToCollection('renovados', newLead);
    } else if (newLead.insuranceType === 'Renovação' && currentView === 'renewals') {
        // Criado manualmente na tela de renovações
        addDataToCollection('renovacoes', newLead);
    } else {
        // Padrão (Meus Leads)
        addDataToCollection('leads', newLead);
    }
  };

  // Atualizar Lead (Procura em qual coleção ele está pelo ID ou contexto, mas como IDs são unicos, update genérico seria ideal, 
  // mas aqui sabemos o contexto pela View ou passamos a coleção certa)
  const handleUpdateLead = (updatedLead: Lead) => {
      // Identificar a coleção de origem
      // A maneira mais segura sem mudar a estrutura do objeto é tentar atualizar na coleção correspondente a view atual
      // ou procurar onde ele existe.
      
      // Simplificação baseada na View atual:
      if (currentView === 'leads') {
          updateDataInCollection('leads', updatedLead.id, updatedLead);
      } else if (currentView === 'renewals' || currentView === 'insured') {
          // Segurados e Renovações usam a mesma coleção 'renovacoes'
          updateDataInCollection('renovacoes', updatedLead.id, updatedLead);
      } else if (currentView === 'renewed') {
          updateDataInCollection('renovados', updatedLead.id, updatedLead);
      } else {
          // Fallback: Tenta achar na lista local pra saber qual coleção
          if (leadsCollection.find(l => l.id === updatedLead.id)) updateDataInCollection('leads', updatedLead.id, updatedLead);
          else if (renewalsCollection.find(l => l.id === updatedLead.id)) updateDataInCollection('renovacoes', updatedLead.id, updatedLead);
          else if (renewedCollection.find(l => l.id === updatedLead.id)) updateDataInCollection('renovados', updatedLead.id, updatedLead);
      }
  };

  const handleUpdateUser = (updatedUser: User) => {
    updateDataInCollection('usuarios', updatedUser.id, updatedUser);
  };

  const handleAddUser = (newUser: User) => {
    addDataToCollection('usuarios', newUser);
  };

  const handleUpdateRenovationsTotal = (val: number) => {
      updateTotalRenovacoes(val);
  };

  // Combine collections for ranking or broad stats if needed, 
  // but Dashboard receives specifics now.
  const allLeadsForRanking = [...leadsCollection, ...renewalsCollection, ...renewedCollection];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="bg-indigo-500 w-8 h-8 rounded-lg flex items-center justify-center">L</span>
            Leads AI
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => { setCurrentView('dashboard'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
          
          <button 
            onClick={() => { setCurrentView('leads'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === 'leads' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Users className="w-5 h-5" />
            <span>Meus Leads</span>
          </button>

          <button 
            onClick={() => { setCurrentView('renewals'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === 'renewals' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <RefreshCw className="w-5 h-5" />
            <span>Renovações</span>
          </button>

          <button 
            onClick={() => { setCurrentView('renewed'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === 'renewed' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <CheckCircle className="w-5 h-5" />
            <span>Renovados</span>
          </button>

          <button 
            onClick={() => { setCurrentView('insured'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === 'insured' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <FileText className="w-5 h-5" />
            <span>Segurados</span>
          </button>

          <button 
            onClick={() => { setCurrentView('ranking'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === 'ranking' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Trophy className="w-5 h-5" />
            <span>Ranking</span>
          </button>

          <button 
            onClick={() => { setCurrentView('users'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <UserCog className="w-5 h-5" />
            <span>Usuários</span>
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold">
              A
            </div>
            <div>
              <p className="text-sm font-medium">Admin User</p>
              <p className="text-xs text-slate-500">Premium Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 md:hidden">
            <h1 className="font-bold text-gray-800">Leads AI</h1>
            <button className="p-2 text-gray-600">☰</button>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-8 relative bg-gray-100">
            {currentView === 'dashboard' && (
                <Dashboard 
                    newLeadsData={leadsCollection}
                    renewalLeadsData={[...renewalsCollection, ...renewedCollection]} // Renovações considera a carteira (aberta + fechada)
                    manualRenewalTotal={manualRenewalTotal}
                    onUpdateRenewalTotal={handleUpdateRenovationsTotal}
                />
            )}
            
            {currentView === 'leads' && (
                <div className="h-full">
                    <LeadList 
                        leads={leadsCollection} 
                        onSelectLead={() => {}}
                        onUpdateLead={handleUpdateLead}
                        onAddLead={handleAddLead}
                    />
                </div>
            )}

            {currentView === 'renewals' && (
                <div className="h-full">
                    <RenewalList 
                        leads={renewalsCollection} 
                        onUpdateLead={handleUpdateLead} 
                        onAddLead={handleAddLead} 
                    />
                </div>
            )}

            {currentView === 'renewed' && (
                <div className="h-full">
                    <RenewedList 
                        leads={renewedCollection} 
                        onUpdateLead={handleUpdateLead} 
                    />
                </div>
            )}

            {currentView === 'insured' && (
                <div className="h-full">
                    {/* Segurados puxa da aba renovações (que contém o histórico de clientes) */}
                    <InsuredList 
                        leads={renewalsCollection} 
                        onUpdateLead={handleUpdateLead} 
                    />
                </div>
            )}

            {currentView === 'ranking' && (
                <div className="h-full">
                    <Ranking leads={allLeadsForRanking} users={usersCollection} />
                </div>
            )}

            {currentView === 'users' && (
                <div className="h-full">
                    <UserList 
                        users={usersCollection} 
                        onUpdateUser={handleUpdateUser} 
                        onAddUser={handleAddUser} 
                    />
                </div>
            )}
        </div>
      </main>
    </div>
  );
}
