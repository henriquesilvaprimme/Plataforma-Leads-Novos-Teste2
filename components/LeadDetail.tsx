import React, { useState } from 'react';
import { Lead } from '../types';
import { analyzeLeadWithAI, generateColdEmail } from '../services/geminiService';
import { BrainCircuit, Mail, Sparkles, Car, MapPin, Calendar, Shield } from './Icons';

interface LeadDetailProps {
  lead: Lead;
  onUpdateLead: (updatedLead: Lead) => void;
  onClose: () => void;
}

export const LeadDetail: React.FC<LeadDetailProps> = ({ lead, onUpdateLead, onClose }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null);

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzeLeadWithAI(lead);
    
    const updatedLead: Lead = {
      ...lead,
      aiScore: result.score,
      aiAnalysis: result.summary,
      aiActionPlan: result.actionPlan
    };
    
    onUpdateLead(updatedLead);
    setIsAnalyzing(false);
  };

  const handleEmailGeneration = async () => {
    setIsGeneratingEmail(true);
    const email = await generateColdEmail(lead);
    setGeneratedEmail(email);
    setIsGeneratingEmail(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-full animate-fade-in">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <div>
            <h2 className="text-xl font-bold text-gray-900">{lead.name}</h2>
            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                <Car className="w-4 h-4" />
                {lead.vehicleModel} ({lead.vehicleYear})
            </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            ✕
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto space-y-8">
        
        {/* Basic Info Grid */}
        <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div>
                <label className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1 block">Email</label>
                <p className="text-gray-800 font-medium text-sm break-all">{lead.email}</p>
            </div>
            <div>
                <label className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1 block">Telefone</label>
                <p className="text-gray-800 font-medium text-sm">{lead.phone}</p>
            </div>
            <div>
                <label className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1 block flex items-center gap-1"><MapPin className="w-3 h-3"/> Local</label>
                <p className="text-gray-800 font-medium text-sm">{lead.city}</p>
            </div>
            <div>
                <label className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1 block flex items-center gap-1"><Shield className="w-3 h-3"/> Interesse</label>
                <p className="text-indigo-600 font-bold text-sm">{lead.insuranceType}</p>
            </div>
        </div>
        
        {/* Scheduled Info if exists */}
        {lead.scheduledDate && (
             <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex items-center gap-3">
                <div className="bg-purple-200 p-2 rounded text-purple-700">
                    <Calendar className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs font-bold text-purple-800 uppercase">Agendamento</p>
                    <p className="text-sm font-medium text-purple-900">
                        {new Date(lead.scheduledDate).toLocaleString('pt-BR')}
                    </p>
                </div>
             </div>
        )}

        {/* Notes */}
        <div>
            <h3 className="font-semibold text-gray-800 mb-2">Histórico & Observações</h3>
            <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 border border-gray-200 whitespace-pre-line min-h-[80px]">
                {lead.notes || "Nenhuma observação registrada."}
            </div>
        </div>

        {/* AI Analysis Section */}
        <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-indigo-800">
                    <BrainCircuit className="w-5 h-5" />
                    <h3 className="font-semibold text-lg">Análise Gemini AI</h3>
                </div>
                {!lead.aiScore && (
                    <button 
                        onClick={handleAIAnalysis}
                        disabled={isAnalyzing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isAnalyzing ? (
                            <>
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                Analisando...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Analisar Lead
                            </>
                        )}
                    </button>
                )}
            </div>

            {lead.aiScore !== undefined ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className={`
                            w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4
                            ${lead.aiScore >= 70 ? 'border-green-500 text-green-700 bg-green-50' : 
                              lead.aiScore >= 40 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' : 
                              'border-red-500 text-red-700 bg-red-50'}
                        `}>
                            {lead.aiScore}
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">Potencial de Fechamento</p>
                            <p className="text-sm text-gray-600 italic">{lead.aiAnalysis}</p>
                        </div>
                    </div>
                    
                    {lead.aiActionPlan && (
                        <div className="bg-white rounded-lg p-4 border border-indigo-100/50">
                            <p className="text-xs font-bold text-indigo-400 uppercase mb-2">Dicas de Abordagem</p>
                            <ul className="list-disc pl-5 space-y-1">
                                {lead.aiActionPlan.map((action, idx) => (
                                    <li key={idx} className="text-sm text-gray-700">{action}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-sm text-indigo-600/70">Clique em analisar para obter insights de inteligência artificial sobre este lead.</p>
            )}
        </div>

        {/* Email Generator Section */}
        <div className="border-t border-gray-100 pt-6">
             <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Gerador de Mensagem
                </h3>
                <button 
                    onClick={handleEmailGeneration}
                    disabled={isGeneratingEmail}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium hover:underline disabled:opacity-50"
                >
                    {isGeneratingEmail ? 'Escrevendo...' : 'Gerar Texto'}
                </button>
            </div>

            {generatedEmail && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{generatedEmail}</pre>
                    <div className="mt-3 flex justify-end">
                        <button 
                            onClick={() => navigator.clipboard.writeText(generatedEmail)}
                            className="text-xs bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 text-gray-600 transition-colors"
                        >
                            Copiar Texto
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};