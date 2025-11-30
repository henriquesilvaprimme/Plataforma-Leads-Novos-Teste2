import React, { useState } from 'react';
import { User } from '../types';
import { Crown, Sparkles } from './Icons';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ users, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (users.length === 0) {
        setError('Carregando sistema...');
        return;
    }

    const foundUser = users.find(u => 
        u.login.trim().toLowerCase() === username.trim().toLowerCase() && 
        u.password === password
    );

    if (foundUser) {
        if (!foundUser.isActive) {
            setError('Usuário inativo. Contate o administrador.');
        } else {
            onLogin(foundUser);
        }
    } else {
        setError('Usuário ou senha inválidos.');
    }
  };

  return (
    <div 
        className="min-h-screen w-full flex items-center justify-center bg-cover bg-center bg-no-repeat relative animate-fade-in"
        style={{
            backgroundImage: "url('/background.png')"
        }}
    >
        {/* Dark Overlay - Reduced opacity for lighter background */}
        <div className="absolute inset-0 bg-black/20 z-0"></div>

        <div className="relative z-10 w-full max-w-md p-6">
            <div className="bg-blue-900/50 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/20">
                <div className="p-8 flex flex-col items-center text-center">
                    
                    {/* Logo / Crown Area */}
                    <div className="mb-4 relative">
                        <Crown className="w-16 h-16 text-yellow-400 drop-shadow-md" />
                        <Sparkles className="w-6 h-6 text-yellow-300 absolute -top-1 -right-2 animate-pulse" />
                        <Sparkles className="w-4 h-4 text-yellow-200 absolute bottom-1 -left-2 animate-pulse delay-75" />
                    </div>

                    <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">
                        Grupo Primme Seguros
                    </h1>
                    <p className="text-sm font-medium text-blue-100 uppercase tracking-widest mb-8 border-b border-white/20 pb-2 px-4">
                        Corretora de Seguros
                    </p>

                    <form onSubmit={handleLogin} className="w-full space-y-4">
                        <div className="text-left">
                            <label className="block text-xs font-bold text-blue-100 uppercase mb-1 ml-1">Usuário</label>
                            <input 
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border border-white/30 bg-white/10 text-white placeholder-blue-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50 outline-none transition-all font-medium"
                                placeholder="Seu login..."
                                required
                            />
                        </div>
                        <div className="text-left">
                            <label className="block text-xs font-bold text-blue-100 uppercase mb-1 ml-1">Senha</label>
                            <input 
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border border-white/30 bg-white/10 text-white placeholder-blue-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50 outline-none transition-all"
                                placeholder="••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/80 border border-red-400 rounded-lg text-white text-sm font-bold animate-fade-in">
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg transform active:scale-95 transition-all mt-4 border border-indigo-500"
                        >
                            ENTRAR
                        </button>
                    </form>

                    <div className="mt-6 text-xs text-blue-200/70">
                        &copy; {new Date().getFullYear()} Grupo Primme Seguros. Sistema Interno.
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
