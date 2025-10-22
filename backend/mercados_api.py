#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API para dados da biblioteca mercados
"""

import mercados.b3
from datetime import date, timedelta
import json
from typing import Dict, List, Any, Optional

class MercadosAPI:
    def __init__(self):
        self.b3 = mercados.b3.B3()
        self.cache = {}
        self.cache_timeout = 3600  # 1 hora em segundos
    
    def _get_cached_data(self, key: str, data_func, *args, **kwargs):
        """Cache simples para evitar chamadas excessivas"""
        import time
        
        # Criar chave única baseada nos parâmetros
        cache_key = f"{key}_{hash(str(args) + str(kwargs))}"
        
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if time.time() - timestamp < self.cache_timeout:
                return cached_data
        
        try:
            data = data_func(*args, **kwargs)
            self.cache[cache_key] = (data, time.time())
            return data
        except Exception as e:
            print(f"Erro ao obter dados para {key}: {e}")
            return []
    
    def obter_bdrs(self, limite: int = 50) -> List[Dict[str, Any]]:
        """Obter lista de BDRs"""
        try:
            # Sempre obter dados frescos da biblioteca
            bdrs_generator = self.b3.bdrs()
            bdrs_lista = list(bdrs_generator)
            
            # Formatar dados para o frontend
            bdrs_formatados = []
            for bdr in bdrs_lista[:limite]:
                bdrs_formatados.append({
                    'codigo': bdr.get('codeCVM', ''),
                    'empresa': bdr.get('companyName', ''),
                    'ticker': bdr.get('tradingName', ''),
                    'cnpj': bdr.get('cnpj', ''),
                    'status': bdr.get('status', ''),
                    'setor': bdr.get('sector', ''),
                    'data_listagem': bdr.get('dateListing', ''),
                    'tipo_bdr': bdr.get('typeBDR', ''),
                    'categoria': bdr.get('describleCategoryBVMF', ''),
                    'mercado': bdr.get('market', ''),
                    'tem_cotacao': bdr.get('hasQuotation', 'N') == 'S'
                })
            
            return bdrs_formatados
        except Exception as e:
            print(f"Erro ao obter BDRs: {e}")
            return []
    
    def obter_debentures(self, limite: int = 50) -> List[Dict[str, Any]]:
        """Obter lista de Debentures"""
        try:
            debentures_generator = self.b3.debentures()
            debentures_lista = list(debentures_generator)
            
            # Formatar dados para o frontend
            debentures_formatados = []
            for deb in debentures_lista[:limite]:
                debentures_formatados.append({
                    'codigo': deb.get('Código', ''),
                    'emissor': deb.get('Emissor', ''),
                    'agente_fiduciario': deb.get('Agente Fiduciário', ''),
                    'volume_emissao': deb.get('Volume Emissão', ''),
                    'remuneracao': deb.get('Remuneração', ''),
                    'data_emissao': deb.get('Data de Emissão', ''),
                    'data_vencimento': deb.get('Data de Vencimento', ''),
                    'isin': deb.get('ISIN', ''),
                    'destinacao_recurso': deb.get('Destinação do recurso (Lei 12.431)', ''),
                    'numero_emissao': deb.get('Nº da Emissão', ''),
                    'numero_serie': deb.get('Nº da série', '')
                })
            
            return debentures_formatados
        except Exception as e:
            print(f"Erro ao obter Debentures: {e}")
            return []
    
    def obter_cris(self, limite: int = 50) -> List[Dict[str, Any]]:
        """Obter lista de CRIs"""
        try:
            # CNPJs de securitizadoras que funcionam
            cnpjs_funcionais = [
                '3767538000114',  # BRAZILIAN SECURITIES
                '9538973000153'   # PDG SECURIT
            ]
            
            cris_formatados = []
            
            for cnpj in cnpjs_funcionais:
                try:
                    cris = self.b3.cris(cnpj)
                    cris_lista = list(cris)
                    
                    for cri in cris_lista[:limite//2]:
                        cris_formatados.append({
                            'codigo_identificacao': cri.get('identificationCode', ''),
                            'nome': cri.get('name', ''),
                            'tipo': cri.get('type', ''),
                            'fase': cri.get('fase', ''),
                            'numero_emissao': cri.get('issueNumber', ''),
                            'data_emissao': cri.get('issueDate', ''),
                            'qualificacao_devedor': cri.get('debtorQualification', ''),
                            'nome_devedor': cri.get('debtorName', ''),
                            'series': cri.get('serials', ''),
                            'tipo_fundo': cri.get('typeFund', ''),
                            'cnpj_securitizadora': cnpj
                        })
                except Exception as e:
                    print(f"Erro ao obter CRIs para CNPJ {cnpj}: {e}")
                    continue
            
            return cris_formatados[:limite]
        except Exception as e:
            print(f"Erro ao obter CRIs: {e}")
            return []
    
    
    def obter_cras(self, limite: int = 50) -> List[Dict[str, Any]]:
        """Obter lista de CRAs (Certificados de Recebíveis do Agronegócio)"""
        try:
            # CNPJs de securitizadoras que funcionam para CRAs
            cnpjs_funcionais = [
                '3767538000114',  # BRAZILIAN SECURITIES
                '9538973000153',  # PDG SECURIT
                '35522178000187', # CIASECURIT
                '40593395000106'  # IFIN PARTICIPACOES
            ]
            
            cras_formatados = []
            
            for cnpj in cnpjs_funcionais:
                try:
                    cras = self._get_cached_data(f'cras_{cnpj}', self.b3.cras, cnpj)
                    cras_lista = list(cras)
                    
                    for cra in cras_lista[:limite//len(cnpjs_funcionais)]:  # Dividir entre as securitizadoras
                        cras_formatados.append({
                            'codigo_identificacao': cra.get('identificationCode', ''),
                            'nome': cra.get('name', ''),
                            'tipo': cra.get('type', ''),
                            'fase': cra.get('fase', ''),
                            'numero_emissao': cra.get('issueNumber', ''),
                            'data_emissao': cra.get('issueDate', ''),
                            'qualificacao_devedor': cra.get('debtorQualification', ''),
                            'nome_devedor': cra.get('debtorName', ''),
                            'series': cra.get('serials', ''),
                            'tipo_fundo': cra.get('typeFund', ''),
                            'cnpj_securitizadora': cnpj
                        })
                except Exception as e:
                    print(f"Erro ao obter CRAs para CNPJ {cnpj}: {e}")
                    continue
            
            return cras_formatados[:limite]
        except Exception as e:
            print(f"Erro ao obter CRAs: {e}")
            return []
    
    def obter_carteira_ibov(self) -> List[Dict[str, Any]]:
        """Obter carteira do IBOV"""
        try:
            carteira_generator = self.b3.carteira_indice('IBOV')
            carteira_lista = list(carteira_generator)
            
            # Formatar dados para o frontend
            carteira_formatada = []
            for ativo in carteira_lista:
                carteira_formatada.append({
                    'codigo': ativo.get('cod', ''),
                    'nome': ativo.get('asset', ''),
                    'tipo': ativo.get('type', ''),
                    'participacao': ativo.get('part', ''),
                    'quantidade_teorica': ativo.get('theoricalQty', ''),
                    'segmento': ativo.get('segment', '')
                })
            
            return carteira_formatada
        except Exception as e:
            print(f"Erro ao obter carteira IBOV: {e}")
            return []
    
    def obter_negociacoes_balcao(self, data: Optional[date] = None, limite: int = 100) -> List[Dict[str, Any]]:
        """Obter negociações de balcão"""
        try:
            if data is None:
                data = date.today() - timedelta(days=1)
            
            negociacoes = self._get_cached_data(f'negociacoes_balcao_{data}', self.b3.negociacao_balcao, data)
            negociacoes_lista = list(negociacoes)
            
            # Formatar dados para o frontend
            negociacoes_formatadas = []
            for neg in negociacoes_lista[:limite]:
                negociacoes_formatadas.append({
                    'codigo': str(neg.codigo) if hasattr(neg, 'codigo') else '',
                    'codigo_if': str(neg.codigo_if) if hasattr(neg, 'codigo_if') else '',
                    'instrumento': str(neg.instrumento) if hasattr(neg, 'instrumento') else '',
                    'datahora': str(neg.datahora) if hasattr(neg, 'datahora') else '',
                    'quantidade': str(neg.quantidade) if hasattr(neg, 'quantidade') else '',
                    'preco': str(neg.preco) if hasattr(neg, 'preco') else '',
                    'volume': str(neg.volume) if hasattr(neg, 'volume') else '',
                    'origem': str(neg.origem) if hasattr(neg, 'origem') else '',
                    'emissor': str(neg.emissor) if hasattr(neg, 'emissor') else '',
                    'situacao': str(neg.situacao) if hasattr(neg, 'situacao') else '',
                    'data_liquidacao': str(neg.data_liquidacao) if hasattr(neg, 'data_liquidacao') else ''
                })
            
            return negociacoes_formatadas
        except Exception as e:
            print(f"Erro ao obter negociações de balcão: {e}")
            return []
    
    def obter_negociacoes_intraday(self, data: Optional[date] = None, limite: int = 100) -> List[Dict[str, Any]]:
        """Obter negociações intraday"""
        try:
            if data is None:
                data = date.today() - timedelta(days=1)
            
            negociacoes = self._get_cached_data(f'negociacoes_intraday_{data}', self.b3.negociacao_intraday, data)
            negociacoes_lista = list(negociacoes)
            
            # Formatar dados para o frontend
            negociacoes_formatadas = []
            for neg in negociacoes_lista[:limite]:
                negociacoes_formatadas.append({
                    'data_referencia': neg.get('DataReferencia', ''),
                    'codigo_instrumento': neg.get('CodigoInstrumento', ''),
                    'preco_negocio': neg.get('PrecoNegocio', ''),
                    'quantidade_negociada': neg.get('QuantidadeNegociada', ''),
                    'hora_fechamento': neg.get('HoraFechamento', ''),
                    'codigo_identificador_negocio': neg.get('CodigoIdentificadorNegocio', ''),
                    'tipo_sessao_pregao': neg.get('TipoSessaoPregao', ''),
                    'data_negocio': neg.get('DataNegocio', ''),
                    'codigo_participante_comprador': neg.get('CodigoParticipanteComprador', ''),
                    'codigo_participante_vendedor': neg.get('CodigoParticipanteVendedor', '')
                })
            
            return negociacoes_formatadas
        except Exception as e:
            print(f"Erro ao obter negociações intraday: {e}")
            return []
    
    def obter_securitizadoras(self) -> List[Dict[str, Any]]:
        """Obter lista de securitizadoras"""
        try:
            securitizadoras = self._get_cached_data('securitizadoras', self.b3.securitizadoras)
            securitizadoras_lista = list(securitizadoras)
            
            # Formatar dados para o frontend
            securitizadoras_formatadas = []
            for sec in securitizadoras_lista:
                securitizadoras_formatadas.append({
                    'nome_empresa': sec.get('companyName', ''),
                    'nome_negociacao': sec.get('tradingName', ''),
                    'governanca': sec.get('corporateGovernance', ''),
                    'codigo_cvm': sec.get('cvmCode', ''),
                    'cnpj': sec.get('cnpj', '')
                })
            
            return securitizadoras_formatadas
        except Exception as e:
            print(f"Erro ao obter securitizadoras: {e}")
            return []
    
    def obter_resumo_mercado(self) -> Dict[str, Any]:
        """Obter resumo completo do mercado"""
        try:
            # Obter dados individuais
            bdrs_dados = self.obter_bdrs(50)
            debentures_dados = self.obter_debentures(50)
            cris_dados = self.obter_cris(50)
            cras_dados = self.obter_cras(50)
            ibov_dados = self.obter_carteira_ibov()
            negociacoes_balcao_dados = self.obter_negociacoes_balcao(limite=50)
            negociacoes_intraday_dados = self.obter_negociacoes_intraday(limite=50)
            securitizadoras_dados = self.obter_securitizadoras()
            
            return {
                'data_atualizacao': date.today().strftime('%Y-%m-%d'),
                'bdrs': {
                    'total': len(bdrs_dados),
                    'dados': bdrs_dados[:10]  # Primeiros 10 para exibição
                },
                'debentures': {
                    'total': len(debentures_dados),
                    'dados': debentures_dados[:10]
                },
                'cris': {
                    'total': len(cris_dados),
                    'dados': cris_dados[:10]
                },
                'cras': {
                    'total': len(cras_dados),
                    'dados': cras_dados[:10]
                },
            'ibov': {
                'total': len(ibov_dados),
                'dados': ibov_dados[:10]
            },
            'tesouro_direto': {
                'total': 0,  # Será implementado em breve
                'dados': []
            },
                'negociacoes_balcao': {
                    'total': len(negociacoes_balcao_dados),
                    'dados': negociacoes_balcao_dados[:10]
                },
                'negociacoes_intraday': {
                    'total': len(negociacoes_intraday_dados),
                    'dados': negociacoes_intraday_dados[:10]
                },
                'securitizadoras': {
                    'total': len(securitizadoras_dados),
                    'dados': securitizadoras_dados
                }
            }
        except Exception as e:
            print(f"Erro ao obter resumo do mercado: {e}")
            return {
                'data_atualizacao': date.today().strftime('%Y-%m-%d'),
                'erro': str(e)
            }

# Instância global da API
mercados_api = MercadosAPI()
