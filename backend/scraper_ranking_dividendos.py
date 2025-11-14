"""
Scraper para buscar rankings de dividendos do agendadividendos.com
Quando mes/ano são fornecidos, usa o scraper do investidor10 para buscar dados da agenda
"""

import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

def extrair_ranking_tabela(tabela, tipo_ativo: str) -> List[Dict[str, Any]]:
    """Extrai dados de ranking de uma tabela HTML"""
    ranking = []
    
    linhas = tabela.find_all('tr')
    if len(linhas) < 2:  # Precisa ter pelo menos cabeçalho + 1 linha
        return ranking
    
    # Pular cabeçalho
    for linha in linhas[1:]:
        celulas = linha.find_all(['td', 'th'])
        if len(celulas) >= 3:  # Esperamos pelo menos 3 colunas (posição, ticker, valor)
            try:
                # Estrutura típica: Posição, Ticker/Nome, Valor do dividendo, etc.
                texto_celulas = [cell.get_text(strip=True) for cell in celulas]
                
                # Tentar encontrar ticker (geralmente na segunda ou terceira coluna)
                ticker = None
                nome = None
                posicao = None
                valor_dividendo = None
                dividend_yield = None
                
                # Primeira célula geralmente é a posição
                if texto_celulas[0]:
                    posicao_match = re.search(r'(\d+)', texto_celulas[0])
                    if posicao_match:
                        posicao = int(posicao_match.group(1))
                
                # Procurar ticker nas células
                for i, texto in enumerate(texto_celulas):
                    if not texto:
                        continue
                    
                    # Verificar se é um ticker (formato: 4 letras + 1-2 números)
                    ticker_match = re.search(r'([A-Z]{4}[0-9]{1,2})', texto.upper())
                    if ticker_match and not ticker:
                        ticker = ticker_match.group(1)
                        # Nome pode estar no mesmo texto após o ticker
                        nome = texto.replace(ticker, '').strip()
                        if not nome:
                            # Tentar próxima célula
                            if i + 1 < len(texto_celulas):
                                nome = texto_celulas[i + 1]
                    
                    # Verificar se é valor monetário
                    if not valor_dividendo and ('R$' in texto or ',' in texto):
                        valor_match = re.search(r'([\d,]+\.?\d*)', texto.replace('R$', '').strip())
                        if valor_match:
                            try:
                                valor_dividendo = float(valor_match.group(1).replace(',', '.'))
                            except:
                                pass
                    
                    # Verificar se é dividend yield (%)
                    if not dividend_yield and ('%' in texto):
                        dy_match = re.search(r'([\d,]+\.?\d*)', texto.replace('%', '').strip())
                        if dy_match:
                            try:
                                dividend_yield = float(dy_match.group(1).replace(',', '.'))
                            except:
                                pass
                
                if ticker:
                    # Determinar tipo de ativo baseado no ticker
                    if ticker.endswith('11'):
                        tipo = 'FII'
                    elif any(bdr in ticker for bdr in ['34', '35', '36']):
                        tipo = 'BDR'
                    else:
                        tipo = 'Acao'
                    
                    ranking.append({
                        'posicao': posicao or len(ranking) + 1,
                        'ticker': ticker,
                        'nome': nome or '',
                        'tipo_ativo': tipo,
                        'valor_dividendo': valor_dividendo,
                        'dividend_yield': dividend_yield,
                        'fonte': 'agendadividendos.com'
                    })
                
            except Exception as e:
                # Pular linhas com erro
                continue
    
    return ranking

def buscar_ranking_dividendos(tipo: str = 'acoes', mes: Optional[int] = None, ano: Optional[int] = None) -> Dict[str, Any]:

    tipo_map = {
        'acoes': 'acoes',
        'fiis': 'fii',
        'bdrs': 'bdr'
    }
    
    # Se mês e ano foram fornecidos, buscar da agenda e criar ranking baseado em data-com
    if mes is not None and ano is not None:
        try:
            from scraper_agenda_dividendos_investidor10 import buscar_agenda_dividendos
            
            # Buscar agenda de dividendos para o mês/ano específico
            tipo_agenda_map = {
                'acoes': 'acoes',
                'fiis': 'fiis',
                'bdrs': 'bdrs'
            }
            tipo_agenda = tipo_agenda_map.get(tipo, tipo)
            
            agenda = buscar_agenda_dividendos(mes=mes, ano=ano, tipo_ativo=tipo_agenda)
            
            # Agrupar dividendos por ticker e calcular totais
            ticker_data = {}
            
            # Determinar qual lista usar baseado no tipo
            if tipo == 'acoes':
                dividendos_lista = agenda.get('acoes', {}).get('dividendos', [])
            elif tipo == 'fiis':
                dividendos_lista = agenda.get('fiis', {}).get('dividendos', [])
            elif tipo == 'bdrs':
                dividendos_lista = agenda.get('bdrs', {}).get('dividendos', [])
            else:
                dividendos_lista = []
            
            # Agrupar por ticker
            for div in dividendos_lista:
                ticker = div.get('ticker', '').upper()
                if not ticker:
                    continue
                
                if ticker not in ticker_data:
                    ticker_data[ticker] = {
                        'ticker': ticker,
                        'nome': div.get('nome', ''),
                        'tipo_ativo': div.get('tipo_ativo', ''),
                        'total_dividendos': 0,
                        'quantidade_dividendos': 0,
                        'data_com': div.get('data_com', ''),
                    }
                
                ticker_data[ticker]['total_dividendos'] += div.get('valor', 0)
                ticker_data[ticker]['quantidade_dividendos'] += 1
            
            # Converter para lista e ordenar por total de dividendos (decrescente)
            ranking_lista = list(ticker_data.values())
            ranking_lista.sort(key=lambda x: x['total_dividendos'], reverse=True)
            
            # Adicionar posição e formatar
            ranking_final = []
            for idx, item in enumerate(ranking_lista, 1):
                ranking_final.append({
                    'posicao': idx,
                    'ticker': item['ticker'],
                    'nome': item['nome'],
                    'tipo_ativo': item['tipo_ativo'],
                    'valor_dividendo': item['total_dividendos'],
                    'quantidade_dividendos': item['quantidade_dividendos'],
                    'data_com': item['data_com'],
                    'fonte': 'agendadividendos.com'
                })
            
            return {
                'tipo': tipo,
                'mes': mes,
                'ano': ano,
                'data_busca': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'total': len(ranking_final),
                'ranking': ranking_final
            }
            
        except Exception as e:
            print(f"Erro ao buscar ranking por data-com: {e}")
            import traceback
            traceback.print_exc()
            # Se falhar, retornar ranking vazio
            return {
                'tipo': tipo,
                'mes': mes,
                'ano': ano,
                'data_busca': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'erro': str(e),
                'total': 0,
                'ranking': []
            }
    
    # Se não foi fornecido mês/ano, buscar ranking geral do site
    tipo_url = tipo_map.get(tipo, 'acoes')
    url = f"https://agendadividendos.com/ranking-dividendos/{tipo_url}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Encontrar todas as tabelas
        tabelas = soup.find_all('table')
        
        todos_rankings = []
        
        # Extrair dados de cada tabela
        for tabela in tabelas:
            rankings = extrair_ranking_tabela(tabela, tipo)
            todos_rankings.extend(rankings)
        
        # Remover duplicatas (manter primeira ocorrência)
        seen = set()
        ranking_unico = []
        for item in todos_rankings:
            if item['ticker'] not in seen:
                seen.add(item['ticker'])
                ranking_unico.append(item)
        
        # Ordenar por posição
        ranking_unico.sort(key=lambda x: x['posicao'])
        
        return {
            'tipo': tipo,
            'data_busca': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'total': len(ranking_unico),
            'ranking': ranking_unico
        }
        
    except Exception as e:
        print(f"Erro ao buscar ranking de dividendos: {e}")
        import traceback
        traceback.print_exc()
        return {
            'tipo': tipo,
            'data_busca': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'erro': str(e),
            'total': 0,
            'ranking': []
        }

def buscar_todos_rankings(mes: Optional[int] = None, ano: Optional[int] = None) -> Dict[str, Any]:
    """Busca rankings de todos os tipos"""
    acoes = buscar_ranking_dividendos('acoes', mes=mes, ano=ano)
    fiis = buscar_ranking_dividendos('fiis', mes=mes, ano=ano)
    bdrs = buscar_ranking_dividendos('bdrs', mes=mes, ano=ano)
    
    return {
        'data_busca': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'mes': mes,
        'ano': ano,
        'acoes': acoes,
        'fiis': fiis,
        'bdrs': bdrs
    }

if __name__ == "__main__":
    # Teste
    print("Testando scraper de ranking de dividendos...")
    resultado = buscar_todos_rankings()
    print(f"\nResultado:")
    print(f"  Acoes: {resultado['acoes']['total']} itens")
    print(f"  FIIs: {resultado['fiis']['total']} itens")
    print(f"  BDRs: {resultado['bdrs']['total']} itens")
    
    if resultado['acoes']['ranking']:
        print(f"\nExemplo de acao:")
        print(f"  {resultado['acoes']['ranking'][0]}")

