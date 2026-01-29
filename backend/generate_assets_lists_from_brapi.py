#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerar listas de Ações, FIIs e BDRs a partir do arquivo brapi_all_assets.json,
no mesmo molde do arquivo backend/assets_lists.py, sem substituir o original.

Uso sugerido (a partir do diretório backend):

    python generate_assets_lists_from_brapi.py

Isso vai ler ../brapi_all_assets.json e criar um novo arquivo:
    assets_lists_from_brapi.py

com:
    LISTA_ACOES_BRAPI = [...]
    LISTA_FIIS_BRAPI = [...]
    LISTA_BDRS_BRAPI = [...]
"""

import json
import os
from typing import Any, Dict, List, Set


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAPI_JSON_PATH = os.path.join(PROJECT_ROOT, "brapi_all_assets.json")
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets_lists_from_brapi.py")


def normalizar_acao(ticker: str) -> str:
    """
    Normaliza ticker de ação no padrão usado em LISTA_ACOES:
    - Ticker como vem do brapi (ex: PETR4)
    - Sufixo '.sa' minúsculo
    """
    ticker = (ticker or "").strip().upper()
    if not ticker:
        return ""
    # Evitar duplicar sufixo se já vier com .SA
    if ticker.endswith(".SA") or ticker.endswith(".sa"):
        return ticker[:-3] + ".sa"
    return ticker + ".sa"


def normalizar_fii_ou_bdr(ticker: str) -> str:
    """
    Normaliza ticker de FII/BDR no padrão usado em LISTA_FIIS / LISTA_BDRS:
    - Ticker em maiúsculas
    - Sufixo '.SA' maiúsculo (quando fizer sentido)
    """
    ticker = (ticker or "").strip().upper()
    if not ticker:
        return ""
    # Alguns tickers podem já vir com .SA
    if ticker.endswith(".SA"):
        return ticker
    if ticker.endswith(".sa"):
        return ticker[:-3] + ".SA"
    # Alguns BDRs/ativos estrangeiros podem não ser .SA (ex: BYDDY, STLA)
    # Nesses casos, mantemos sem sufixo para não quebrar uso atual.
    # Heurística simples: se parecer B3 (terminar com número), adiciona .SA
    if any(ch.isdigit() for ch in ticker[-2:]):
        return ticker + ".SA"
    return ticker


def carregar_brapi_assets() -> List[Dict[str, Any]]:
    if not os.path.exists(BRAPI_JSON_PATH):
        raise FileNotFoundError(f"Arquivo brapi_all_assets.json não encontrado em: {BRAPI_JSON_PATH}")

    with open(BRAPI_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    assets = data.get("assets") or data.get("stocks") or []
    if not isinstance(assets, list):
        raise ValueError("Formato inesperado em brapi_all_assets.json: campo 'assets' não é uma lista.")
    return assets


def remover_fracionados(lista: List[str]) -> List[str]:
    """
    Remove tickers fracionados (com 'F' antes do sufixo).
    Exemplos:
    - "POMO3F.sa" → removido (mantém "POMO3.sa")
    - "PETR4F.sa" → removido (mantém "PETR4.sa")
    - "MXRF11F.SA" → removido (mantém "MXRF11.SA")
    """
    resultado = []
    fracionados_removidos = []
    
    for ticker in lista:
        # Verificar se termina com F antes do sufixo (.sa ou .SA)
        # Exemplos: "POMO3F.sa", "PETR4F.SA"
        is_fracionado = False
        
        if ticker.endswith(".sa"):
            base = ticker[:-3]  # Remove ".sa"
            if base.endswith("F"):
                is_fracionado = True
        elif ticker.endswith(".SA"):
            base = ticker[:-3]  # Remove ".SA"
            if base.endswith("F"):
                is_fracionado = True
        
        if is_fracionado:
            fracionados_removidos.append(ticker)
        else:
            resultado.append(ticker)
    
    if fracionados_removidos:
        print(f"[INFO] Removidos {len(fracionados_removidos)} tickers fracionados")
        if len(fracionados_removidos) <= 10:
            print(f"[INFO] Exemplos removidos: {', '.join(fracionados_removidos[:10])}")
    
    return resultado


def gerar_listas(assets: List[Dict[str, Any]]):
    acoes: Set[str] = set()
    fiis: Set[str] = set()
    bdrs: Set[str] = set()

    for item in assets:
        # Estrutura típica:
        # {
        #   "stock": "RAIZ4",
        #   "name": "...",
        #   "type": "stock" | "fund" | "bdr" | ...
        # }
        ticker = (item.get("stock") or item.get("symbol") or "").strip()
        tipo = (item.get("type") or "").strip().lower()

        if not ticker or not tipo:
            continue

        if tipo == "stock":
            norm = normalizar_acao(ticker)
            if norm:
                acoes.add(norm)
        elif tipo == "fund":
            norm = normalizar_fii_ou_bdr(ticker)
            if norm:
                fiis.add(norm)
        elif tipo == "bdr":
            norm = normalizar_fii_ou_bdr(ticker)
            if norm:
                bdrs.add(norm)
        else:
            # Outros tipos (etf, index, etc) ignorados por enquanto
            continue

    # Ordenar primeiro
    lista_acoes = sorted(acoes)
    lista_fiis = sorted(fiis)
    lista_bdrs = sorted(bdrs)
    
    # Remover fracionados
    lista_acoes = remover_fracionados(lista_acoes)
    lista_fiis = remover_fracionados(lista_fiis)
    lista_bdrs = remover_fracionados(lista_bdrs)
    
    return lista_acoes, lista_fiis, lista_bdrs


def escrever_arquivo_listas(lista_acoes: List[str], lista_fiis: List[str], lista_bdrs: List[str]) -> None:
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("# Arquivo GERADO automaticamente a partir de brapi_all_assets.json\n")
        f.write("# NÃO editar manualmente; rode generate_assets_lists_from_brapi.py para atualizar.\n\n")

        f.write("# ==================== LISTA DE AÇÕES (BRAPI) ====================\n")
        f.write("LISTA_ACOES_BRAPI = [\n")
        for t in lista_acoes:
            f.write(f"    \"{t}\",\n")
        f.write("]\n\n")

        f.write("# ==================== LISTA DE FIIs (BRAPI) ====================\n")
        f.write("LISTA_FIIS_BRAPI = [\n")
        for t in lista_fiis:
            f.write(f"    \"{t}\",\n")
        f.write("]\n\n")

        f.write("# ==================== LISTA DE BDRs (BRAPI) ====================\n")
        f.write("LISTA_BDRS_BRAPI = [\n")
        for t in lista_bdrs:
            f.write(f"    \"{t}\",\n")
        f.write("]\n")


def main() -> None:
    print(f"[INFO] Lendo ativos do brapi em: {BRAPI_JSON_PATH}")
    assets = carregar_brapi_assets()
    print(f"[INFO] Total de registros no JSON: {len(assets)}")

    lista_acoes, lista_fiis, lista_bdrs = gerar_listas(assets)

    print(f"[INFO] Ações identificadas: {len(lista_acoes)}")
    print(f"[INFO] FIIs identificados: {len(lista_fiis)}")
    print(f"[INFO] BDRs identificados: {len(lista_bdrs)}")

    escrever_arquivo_listas(lista_acoes, lista_fiis, lista_bdrs)
    print(f"[OK] Arquivo gerado em: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

