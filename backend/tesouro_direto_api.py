#!/usr/bin/env python3
"""
API para títulos do Tesouro Direto usando tesouro-direto-br
"""

import tesouro_direto_br
import pandas as pd
from datetime import datetime, timedelta
from flask import jsonify, request
import json

def obter_titulos_tesouro_direto():
    """
    Obtém lista atualizada dos títulos disponíveis do Tesouro Direto
    """
    try:
        # 1. Obter dados históricos
        titulos_historicos = tesouro_direto_br.busca_tesouro_direto()
        
        # 2. Obter nomenclatura
        nomeclatura = tesouro_direto_br.nomeclatura_titulos()
        
        # 3. Obter dados mais recentes
        data_recente = titulos_historicos['Data Venda'].max()
        dados_recentes = titulos_historicos[titulos_historicos['Data Venda'] == data_recente]
        
        # 4. Processar títulos disponíveis
        titulos_disponiveis = []
        
        for idx, row in dados_recentes.iterrows():
            tipo_titulo = idx[0]
            vencimento = idx[1]
            pu = row['PU']
            quantidade = row['Quantidade']
            valor = row['Valor']
            
            # Obter código da nomenclatura
            codigo = nomeclatura.get(tipo_titulo, 'N/A')
            
            # Determinar características do título
            if 'Prefixado' in tipo_titulo:
                tipo_fixacao = 'PRÉ-FIXADO'
                indexador = 'Taxa Fixa'
                indexador_normalizado = 'PREFIXADO'
            elif 'Selic' in tipo_titulo:
                tipo_fixacao = 'PÓS-FIXADO'
                indexador = 'SELIC'
                indexador_normalizado = 'SELIC'
            elif 'IPCA' in tipo_titulo:
                tipo_fixacao = 'PÓS-FIXADO'
                indexador = 'IPCA + Taxa'
                indexador_normalizado = 'IPCA'
            elif 'IGPM' in tipo_titulo:
                tipo_fixacao = 'PÓS-FIXADO'
                indexador = 'IGP-M + Taxa'
                indexador_normalizado = 'IGPM'
            elif 'Educa' in tipo_titulo:
                tipo_fixacao = 'PÓS-FIXADO'
                indexador = 'IPCA + Taxa'
                indexador_normalizado = 'IPCA'
            elif 'RendA' in tipo_titulo:
                tipo_fixacao = 'PÓS-FIXADO'
                indexador = 'IPCA + Taxa'
                indexador_normalizado = 'IPCA'
            else:
                tipo_fixacao = 'N/A'
                indexador = 'N/A'
                indexador_normalizado = 'N/A'
            
            # Calcular dias para vencimento
            dias_vencimento = (vencimento - data_recente).days
            
            # Determinar valor mínimo (aproximado)
            valor_minimo = pu * 0.01  # 1% do PU como mínimo aproximado
            
            # Determinar valor máximo (aproximado)
            valor_maximo = pu * quantidade  # Valor total disponível
            
            titulo_info = {
                'ticker': f"TD_{codigo}_{vencimento.strftime('%Y%m%d')}",
                'nome': tipo_titulo,
                'codigo': codigo,
                'vencimento': vencimento.strftime('%Y-%m-%d'),
                'dias_vencimento': dias_vencimento,
                'tipo_fixacao': tipo_fixacao,
                'indexador': indexador,
                'indexador_normalizado': indexador_normalizado,
                'pu': pu,
                'valor_minimo': valor_minimo,
                'valor_maximo': valor_maximo,
                'quantidade_disponivel': quantidade,
                'valor_total': valor,
                'data_referencia': data_recente.strftime('%Y-%m-%d'),
                'categoria': categorizar_titulo(tipo_titulo),
                'liquidez': 'Alta' if valor > 1000000 else 'Média' if valor > 100000 else 'Baixa',
                'cupom_semestral': 'com juros semestrais' in tipo_titulo.lower(),
                'familia_td': obter_familia_td(tipo_titulo)
            }
            
            titulos_disponiveis.append(titulo_info)
        
        # 5. Ordenar por vencimento
        titulos_disponiveis.sort(key=lambda x: x['vencimento'])
        
        return {
            'titulos': titulos_disponiveis,
            'total': len(titulos_disponiveis),
            'data_referencia': data_recente.strftime('%Y-%m-%d'),
            'categorias': list(set([t['categoria'] for t in titulos_disponiveis])),
            'indexadores': list(set([t['indexador_normalizado'] for t in titulos_disponiveis]))
        }
        
    except Exception as e:
        print(f"ERRO ao obter títulos do Tesouro Direto: {e}")
        return {
            'titulos': [],
            'total': 0,
            'data_referencia': datetime.now().strftime('%Y-%m-%d'),
            'categorias': [],
            'indexadores': [],
            'erro': str(e)
        }

def categorizar_titulo(tipo):
    """Categoriza o título por tipo de indexador"""
    if 'Prefixado' in tipo:
        return 'Taxa Fixa'
    elif 'Selic' in tipo:
        return 'Taxa Selic'
    elif 'IPCA' in tipo:
        return 'Inflação (IPCA)'
    elif 'IGPM' in tipo:
        return 'Inflação (IGP-M)'
    elif 'Educa' in tipo:
        return 'Educação'
    elif 'RendA' in tipo:
        return 'Renda'
    else:
        return 'Outros'

def obter_familia_td(tipo):
    """Obtém a família do título do Tesouro Direto"""
    if 'Prefixado' in tipo and 'Juros Semestrais' in tipo:
        return 'NTN-F'
    elif 'Prefixado' in tipo:
        return 'LTN'
    elif 'Selic' in tipo:
        return 'LTF'
    elif 'IPCA' in tipo and 'Juros Semestrais' in tipo:
        return 'NTN-B'
    elif 'IPCA' in tipo:
        return 'NTN-B Principal'
    elif 'IGPM' in tipo:
        return 'NTN-C'
    elif 'Educa' in tipo:
        return 'EDUCA+'
    elif 'RendA' in tipo:
        return 'RENDA+'
    else:
        return 'Outros'

def obter_ettj_atual():
    """
    Obtém ETTJ atual do Tesouro Direto
    """
    try:
        ettj_module = tesouro_direto_br.ettj
        data_atual = datetime.now().strftime('%d/%m/%Y')
        ettj_data = ettj_module.get_ettj(data_atual)
        
        if hasattr(ettj_data, 'to_dict'):
            return ettj_data.to_dict()
        elif hasattr(ettj_data, 'shape'):
            return {
                'shape': ettj_data.shape,
                'columns': list(ettj_data.columns) if hasattr(ettj_data, 'columns') else [],
                'data': ettj_data.head(10).to_dict() if not ettj_data.empty else {}
            }
        else:
            return {'data': ettj_data}
            
    except Exception as e:
        print(f"ERRO ao obter ETTJ: {e}")
        return {'erro': str(e)}

def obter_movimentacoes_tesouro(tipo_movimentacao='venda'):
    """
    Obtém movimentações do Tesouro Direto
    """
    try:
        movimentacoes = tesouro_direto_br.movimentacoes_titulos_publicos(tipo_movimentacao)
        
        if hasattr(movimentacoes, 'to_dict'):
            return movimentacoes.to_dict()
        elif hasattr(movimentacoes, 'shape'):
            return {
                'shape': movimentacoes.shape,
                'columns': list(movimentacoes.columns) if hasattr(movimentacoes, 'columns') else [],
                'data': movimentacoes.head(10).to_dict() if not movimentacoes.empty else {}
            }
        else:
            return {'data': movimentacoes}
            
    except Exception as e:
        print(f"ERRO ao obter movimentações: {e}")
        return {'erro': str(e)}

if __name__ == "__main__":
    # Teste da API
    print("=== TESTE DA API TESOURO DIRETO ===")
    resultado = obter_titulos_tesouro_direto()
    print(f"Total de títulos: {resultado['total']}")
    print(f"Data de referência: {resultado['data_referencia']}")
    print(f"Categorias: {resultado['categorias']}")
    print(f"Indexadores: {resultado['indexadores']}")
    
    if resultado['titulos']:
        print(f"\nPrimeiro título:")
        primeiro = resultado['titulos'][0]
        for key, value in primeiro.items():
            print(f"  {key}: {value}")
