"""
Scraper de rankings do investidor10.com.br
Reutilizável para buscar rankings de ações, FIIs e BDRs
"""

import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Any, Optional
import time
import re

def buscar_rankings_investidor10(tipo: str) -> Dict[str, Any]:

    urls = {
        'acoes': 'https://investidor10.com.br/acoes/rankings/',
        'fiis': 'https://investidor10.com.br/fiis/rankings/',
        'bdrs': 'https://investidor10.com.br/bdrs/rankings/',
        'criptos': 'https://investidor10.com.br/criptomoedas/rankings/'
    }
    
    url = urls.get(tipo)
    if not url:
        return {'erro': f'Tipo invalido: {tipo}'}
    
    try:
       
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            return {
                'erro': f'Status code {response.status_code}',
                'url': url
            }
        
        # Parsear HTML
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Procurar por cards de ranking
        ranking_cards = soup.find_all('div', class_=lambda x: x and isinstance(x, (str, list)) and 'ranking-card' in str(x).lower())
        
        rankings = []
        rankings_por_tipo = {}
        
        # Processar cada card de ranking
        for card in ranking_cards:
            try:
                # Título do ranking
                header = card.find('header', class_=lambda x: x and isinstance(x, (str, list)) and 'ranking-card--header' in str(x).lower())
                titulo = header.find('h3') if header else None
                titulo_texto = titulo.get_text(strip=True) if titulo else 'Ranking Desconhecido'
                
                # Procurar por itens dentro do card
                items_container = card.find('div', class_=lambda x: x and isinstance(x, (str, list)) and 'ranking-card--items' in str(x).lower())
                if not items_container:
                    continue
                
                # Procurar por itens de ranking dentro do card
                items_ranking = items_container.find_all('div', class_=lambda x: x and isinstance(x, (str, list)) and 'ranking' in str(x).lower())
                
                ranking_items = []
                
               
                for item in items_ranking:
                    try:
                        # Procurar link dentro do item
                        link = item.find('a', href=lambda x: x and ('/acoes/' in x or '/fiis/' in x or '/bdrs/' in x or '/criptomoedas/' in x))
                        if not link:
                            continue
                        
                        href = link.get('href', '')
                        titulo_link = link.get('title', '') or ''
                        
                        # Extrair ticker do href
                        ticker = None
                        if '/acoes/' in href:
                            ticker = href.split('/acoes/')[1].split('/')[0].upper()
                        elif '/fiis/' in href:
                            ticker = href.split('/fiis/')[1].split('/')[0].upper()
                        elif '/bdrs/' in href:
                            ticker = href.split('/bdrs/')[1].split('/')[0].upper()
                        elif '/criptomoedas/' in href:
                            # Para criptomoedas, extrair o nome e converter para ticker padrão
                            crypto_name = href.split('/criptomoedas/')[1].split('/')[0].lower()
                            # Mapear nomes comuns para tickers
                            crypto_map = {
                                'bitcoin': 'BTC-USD',
                                'ethereum': 'ETH-USD',
                                'bnb': 'BNB-USD',
                                'binance-coin': 'BNB-USD',
                                'dogecoin': 'DOGE-USD',
                                'solana': 'SOL-USD',
                                'cardano': 'ADA-USD',
                                'ripple': 'XRP-USD',
                                'xrp': 'XRP-USD',
                                'polkadot': 'DOT-USD',
                                'polygon': 'MATIC-USD',
                                'matic': 'MATIC-USD',
                                'avalanche': 'AVAX-USD',
                                'avax': 'AVAX-USD',
                                'chainlink': 'LINK-USD',
                                'link': 'LINK-USD',
                                'uniswap': 'UNI-USD',
                                'uni': 'UNI-USD',
                                'litecoin': 'LTC-USD',
                                'ltc': 'LTC-USD',
                                'cosmos': 'ATOM-USD',
                                'atom': 'ATOM-USD',
                                'algorand': 'ALGO-USD',
                                'algo': 'ALGO-USD',
                                'stellar': 'XLM-USD',
                                'xlm': 'XLM-USD',
                                'vechain': 'VET-USD',
                                'vet': 'VET-USD',
                                'internet-computer': 'ICP-USD',
                                'icp': 'ICP-USD',
                                'filecoin': 'FIL-USD',
                                'fil': 'FIL-USD',
                                'aave': 'AAVE-USD',
                                'maker': 'MKR-USD',
                                'mkr': 'MKR-USD',
                                'compound': 'COMP-USD',
                                'comp': 'COMP-USD',
                                'yearn-finance': 'YFI-USD',
                                'yfi': 'YFI-USD',
                                'synthetix': 'SNX-USD',
                                'snx': 'SNX-USD',
                                'curve': 'CRV-USD',
                                'crv': 'CRV-USD',
                                'sushi': 'SUSHI-USD',
                                'sushiswap': 'SUSHI-USD',
                                'tron': 'TRX-USD',
                                'trx': 'TRX-USD',
                                'ethereum-classic': 'ETC-USD',
                                'etc': 'ETC-USD',
                                'bitcoin-cash': 'BCH-USD',
                                'bch': 'BCH-USD',
                                'monero': 'XMR-USD',
                                'xmr': 'XMR-USD',
                                'dash': 'DASH-USD',
                                'zcash': 'ZEC-USD',
                                'zec': 'ZEC-USD',
                                'tezos': 'XTZ-USD',
                                'xtz': 'XTZ-USD'
                            }
                            ticker = crypto_map.get(crypto_name, f"{crypto_name.upper().replace('-', '')}-USD")
                        
                        if not ticker:
                            continue
                        
                        # Extrair nome do ativo
                        info_div = link.find('div', class_=lambda x: x and isinstance(x, (str, list)) and 'information' in str(x).lower())
                        nome = titulo_link
                        if info_div:
                            span = info_div.find('span')
                            if span:
                                nome = span.get_text(strip=True) or titulo_link
                        
                        # Extrair valor da métrica
                        valor_div = link.find('div', class_=lambda x: x and isinstance(x, (str, list)) and 'ranking-percentage' in str(x).lower())
                        valor = None
                        tipo_valor = None
                        valor_formatado = None
                        
                        if valor_div:
                            valor_texto_original = valor_div.get_text(strip=True)
                            
                            valor_texto = ' '.join(valor_texto_original.split())
                            

                            if 'R$' in valor_texto or 'US$' in valor_texto:
                                tipo_valor = 'money'
                            else:
                                # Verificar classe CSS
                                classes = valor_div.get('class', [])
                                classes_str = ' '.join(classes) if isinstance(classes, list) else str(classes)
                                
                               
                                if 'percent' in classes_str.lower():
                                    tipo_valor = 'percent'
                                else:
                                   
                                    if '%' in valor_texto and 'R$' not in valor_texto and 'US$' not in valor_texto:
                                        tipo_valor = 'percent'
                                    else:
                                        tipo_valor = 'money'
                            

                            valor_formatado = valor_texto
                            valor = valor_texto  
                        
                        ranking_items.append({
                            'ticker': ticker,
                            'nome': nome,
                            'valor': valor,
                            'valor_formatado': valor_formatado,
                            'tipo_valor': tipo_valor,
                            'url': href
                        })
                    except Exception as e:
                        continue
                
                if ranking_items:
                    rankings_por_tipo[titulo_texto] = ranking_items
                    rankings.extend(ranking_items)
                        
            except Exception as e:
                continue
        
        return {
            'sucesso': True,
            'url': url,
            'tipo': tipo,
            'rankings': rankings,
            'rankings_por_tipo': rankings_por_tipo,
            'total_rankings': len(rankings),
            'total_tipos_ranking': len(rankings_por_tipo)
        }
        
    except requests.exceptions.RequestException as e:
        return {
            'erro': f'Erro na requisicao: {e}',
            'url': url
        }
    except Exception as e:
        import traceback
        return {
            'erro': f'Erro inesperado: {e}',
            'traceback': traceback.format_exc(),
            'url': url
        }

