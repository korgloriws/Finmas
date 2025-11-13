#!/usr/bin/env python3
"""
Script de teste para validação da função calcular_preco_com_indexador
Testa diferentes cenários de valorização de renda fixa com indexadores
"""

import sys
import os
from datetime import datetime, timedelta
from decimal import Decimal

# Adicionar o diretório atual ao path para importar models
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import calcular_preco_com_indexador, _obter_taxa_atual_indexador

def testar_valorizacao_cdi():
    """Testa valorização com CDI"""
    print("\n" + "="*80)
    print("TESTE 1: Valorização CDI 100% (1 mês)")
    print("="*80)
    
    preco_inicial = 2002.00
    indexador = "CDI"
    indexador_pct = 100.0  # 100% do CDI
    data_adicao = datetime.now() - timedelta(days=30)  # 1 mês atrás
    
    print(f"Preço inicial: R$ {preco_inicial:.2f}")
    print(f"Indexador: {indexador} {indexador_pct}%")
    print(f"Data de adição: {data_adicao.strftime('%Y-%m-%d')}")
    print(f"Dias desde adição: {(datetime.now() - data_adicao).days}")
    
    # Obter taxa atual do CDI
    taxa_cdi = _obter_taxa_atual_indexador("CDI")
    print(f"Taxa CDI atual: {taxa_cdi}% a.a.")
    
    # Calcular valorização esperada (aproximada)
    taxa_anual = taxa_cdi * (indexador_pct / 100)
    taxa_diaria = (1 + taxa_anual / 100) ** (1/252) - 1
    dias_uteis = int(round(30 * 252.0 / 365.0))
    fator_esperado = (1 + taxa_diaria) ** dias_uteis
    preco_esperado = preco_inicial * fator_esperado
    
    print(f"\nCálculo esperado:")
    print(f"  Taxa anual indexada: {taxa_anual:.4f}%")
    print(f"  Taxa diária: {taxa_diaria:.8f}")
    print(f"  Dias úteis aproximados: {dias_uteis}")
    print(f"  Fator de correção: {fator_esperado:.6f}")
    print(f"  Preço esperado: R$ {preco_esperado:.2f}")
    
    # Calcular usando a função
    preco_calculado = calcular_preco_com_indexador(preco_inicial, indexador, indexador_pct, data_adicao)
    
    print(f"\nPreço calculado pela função: R$ {preco_calculado:.2f}")
    print(f"Diferença: R$ {abs(preco_calculado - preco_esperado):.2f}")
    
    # Validação
    if abs(preco_calculado - preco_esperado) < 1.0:  # Tolerância de R$ 1
        print("[OK] TESTE PASSOU: Valores estao proximos do esperado")
    else:
        print("[ERRO] TESTE FALHOU: Diferenca muito grande")
    
    return preco_calculado


def testar_valorizacao_cdi_115():
    """Testa valorização com CDI 115%"""
    print("\n" + "="*80)
    print("TESTE 2: Valorização CDI 115% (1 mês)")
    print("="*80)
    
    preco_inicial = 2002.00
    indexador = "CDI"
    indexador_pct = 115.0  # 115% do CDI
    data_adicao = datetime.now() - timedelta(days=30)
    
    print(f"Preço inicial: R$ {preco_inicial:.2f}")
    print(f"Indexador: {indexador} {indexador_pct}%")
    
    preco_calculado = calcular_preco_com_indexador(preco_inicial, indexador, indexador_pct, data_adicao)
    
    print(f"Preço calculado: R$ {preco_calculado:.2f}")
    
    # Validação: deve ser maior que o inicial
    if preco_calculado > preco_inicial:
        print("[OK] TESTE PASSOU: Preco aumentou corretamente")
    else:
        print("[ERRO] TESTE FALHOU: Preco nao aumentou")
    
    # Validação: não pode ser absurdo (não pode ser menor que 80% do inicial)
    if preco_calculado >= preco_inicial * 0.8:
        print("[OK] TESTE PASSOU: Preco esta em range razoavel")
    else:
        print(f"[ERRO] TESTE FALHOU: Preco muito baixo ({preco_calculado:.2f} vs {preco_inicial * 0.8:.2f})")
    
    return preco_calculado


def testar_valorizacao_selic():
    """Testa valorização com SELIC"""
    print("\n" + "="*80)
    print("TESTE 3: Valorização SELIC 100% (1 mês)")
    print("="*80)
    
    preco_inicial = 1000.00
    indexador = "SELIC"
    indexador_pct = 100.0
    data_adicao = datetime.now() - timedelta(days=30)
    
    print(f"Preço inicial: R$ {preco_inicial:.2f}")
    print(f"Indexador: {indexador} {indexador_pct}%")
    
    preco_calculado = calcular_preco_com_indexador(preco_inicial, indexador, indexador_pct, data_adicao)
    
    print(f"Preço calculado: R$ {preco_calculado:.2f}")
    
    if preco_calculado > preco_inicial and preco_calculado < preco_inicial * 1.02:
        print("[OK] TESTE PASSOU: Valorizacao mensal razoavel (menos de 2%)")
    else:
        print("[ERRO] TESTE FALHOU: Valorizacao fora do esperado")
    
    return preco_calculado


def testar_valorizacao_ipca():
    """Testa valorização com IPCA"""
    print("\n" + "="*80)
    print("TESTE 4: Valorização IPCA 100% (1 mês)")
    print("="*80)
    
    preco_inicial = 5000.00
    indexador = "IPCA"
    indexador_pct = 100.0
    data_adicao = datetime.now() - timedelta(days=30)
    
    print(f"Preço inicial: R$ {preco_inicial:.2f}")
    print(f"Indexador: {indexador} {indexador_pct}%")
    
    preco_calculado = calcular_preco_com_indexador(preco_inicial, indexador, indexador_pct, data_adicao)
    
    print(f"Preço calculado: R$ {preco_calculado:.2f}")
    
    # IPCA mensal geralmente é entre 0.3% e 0.8%
    if preco_calculado > preco_inicial and preco_calculado < preco_inicial * 1.01:
        print("[OK] TESTE PASSOU: Valorizacao IPCA mensal razoavel")
    else:
        print("[ERRO] TESTE FALHOU: Valorizacao IPCA fora do esperado")
    
    return preco_calculado


def testar_valorizacao_prefixado():
    """Testa valorização prefixada"""
    print("\n" + "="*80)
    print("TESTE 5: Valorização PREFIXADO 12% a.a. (1 mês)")
    print("="*80)
    
    preco_inicial = 2002.00
    indexador = "PREFIXADO"
    indexador_pct = 12.0  # 12% a.a.
    data_adicao = datetime.now() - timedelta(days=30)
    
    print(f"Preço inicial: R$ {preco_inicial:.2f}")
    print(f"Indexador: {indexador} {indexador_pct}% a.a.")
    
    # Cálculo esperado
    taxa_anual_decimal = 12.0 / 100.0
    taxa_diaria = (1 + taxa_anual_decimal) ** (1/365) - 1
    fator_esperado = (1 + taxa_diaria) ** 30
    preco_esperado = preco_inicial * fator_esperado
    
    print(f"\nCálculo esperado:")
    print(f"  Taxa diária: {taxa_diaria:.8f}")
    print(f"  Fator (30 dias): {fator_esperado:.6f}")
    print(f"  Preço esperado: R$ {preco_esperado:.2f}")
    
    preco_calculado = calcular_preco_com_indexador(preco_inicial, indexador, indexador_pct, data_adicao)
    
    print(f"\nPreço calculado: R$ {preco_calculado:.2f}")
    
    if abs(preco_calculado - preco_esperado) < 0.10:
        print("[OK] TESTE PASSOU: Valores proximos do esperado")
    else:
        print(f"[ERRO] TESTE FALHOU: Diferenca de R$ {abs(preco_calculado - preco_esperado):.2f}")
    
    return preco_calculado


def testar_caso_problema_original():
    """Testa o caso específico que estava dando problema (2002 -> 168)"""
    print("\n" + "="*80)
    print("TESTE 6: Caso do problema original (2002 reais)")
    print("="*80)
    
    preco_inicial = 2002.00
    indexador = "CDI"
    indexador_pct = 100.0
    data_adicao = datetime.now() - timedelta(days=30)
    
    print(f"Preço inicial: R$ {preco_inicial:.2f}")
    print(f"Indexador: {indexador} {indexador_pct}%")
    print(f"Data de adição: {data_adicao.strftime('%Y-%m-%d')}")
    
    # Testar com diferentes tipos de entrada (simulando PostgreSQL)
    print("\n--- Teste com float ---")
    preco1 = calcular_preco_com_indexador(float(preco_inicial), indexador, float(indexador_pct), data_adicao)
    print(f"Resultado (float): R$ {preco1:.2f}")
    
    print("\n--- Teste com Decimal (simulando PostgreSQL) ---")
    from decimal import Decimal
    preco2 = calcular_preco_com_indexador(Decimal(str(preco_inicial)), indexador, Decimal(str(indexador_pct)), data_adicao)
    print(f"Resultado (Decimal): R$ {preco2:.2f}")
    
    print("\n--- Teste com string ---")
    preco3 = calcular_preco_com_indexador(str(preco_inicial), indexador, str(indexador_pct), data_adicao)
    print(f"Resultado (string): R$ {preco3:.2f}")
    
    # Validação crítica
    resultados = [preco1, preco2, preco3]
    todos_validos = all(
        r is not None and 
        r > preco_inicial * 0.8 and 
        r < preco_inicial * 1.02 
        for r in resultados
    )
    
    if todos_validos:
        print("\n[OK] TESTE PASSOU: Todos os tipos de entrada produzem resultados validos")
    else:
        print("\n[ERRO] TESTE FALHOU: Algum tipo de entrada produziu resultado invalido")
        for i, r in enumerate(resultados):
            if r is None or r <= preco_inicial * 0.8 or r >= preco_inicial * 1.02:
                print(f"  Resultado invalido {i+1}: R$ {r:.2f}")
    
    # Validação específica: não pode ser 168
    if all(r != 168.0 for r in resultados if r is not None):
        print("[OK] TESTE PASSOU: Nenhum resultado e 168 (valor do bug)")
    else:
        print("[ERRO] TESTE FALHOU: Resultado e 168 (bug ainda presente)")
    
    return resultados


def testar_valores_extremos():
    """Testa valores extremos que poderiam causar problemas"""
    print("\n" + "="*80)
    print("TESTE 7: Valores extremos e edge cases")
    print("="*80)
    
    testes = [
        ("CDI 0.1% (muito baixo)", "CDI", 0.1, 2002.00),
        ("CDI 1000% (muito alto)", "CDI", 1000.0, 2002.00),
        ("CDI None", "CDI", None, 2002.00),
        ("Preço inicial 0", "CDI", 100.0, 0.0),
        ("Preço inicial negativo", "CDI", 100.0, -100.0),
    ]
    
    for nome, indexador, pct, preco in testes:
        print(f"\n--- {nome} ---")
        try:
            data = datetime.now() - timedelta(days=30)
            resultado = calcular_preco_com_indexador(preco, indexador, pct, data)
            if resultado is None or resultado == preco:
                print(f"[OK] Retornou valor seguro: {resultado}")
            else:
                print(f"[AVISO] Retornou: {resultado}")
        except Exception as e:
            print(f"[OK] Excecao capturada (esperado): {e}")


def main():
    """Executa todos os testes"""
    print("\n" + "="*80)
    print("SUITE DE TESTES: Valorização de Renda Fixa com Indexadores")
    print("="*80)
    print(f"Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    resultados = []
    
    try:
        resultados.append(("CDI 100%", testar_valorizacao_cdi()))
        resultados.append(("CDI 115%", testar_valorizacao_cdi_115()))
        resultados.append(("SELIC 100%", testar_valorizacao_selic()))
        resultados.append(("IPCA 100%", testar_valorizacao_ipca()))
        resultados.append(("PREFIXADO 12%", testar_valorizacao_prefixado()))
        resultados.append(("Caso problema original", testar_caso_problema_original()))
        testar_valores_extremos()
        
        print("\n" + "="*80)
        print("RESUMO DOS TESTES")
        print("="*80)
        for nome, resultado in resultados:
            if isinstance(resultado, list):
                print(f"{nome}: {len([r for r in resultado if r is not None])} resultados válidos")
            elif resultado is not None:
                print(f"{nome}: R$ {resultado:.2f}")
            else:
                print(f"{nome}: None (erro)")
        
        print("\n[OK] Todos os testes foram executados!")
        print("Verifique os resultados acima para validar se os calculos estao corretos.")
        
    except Exception as e:
        print(f"\n[ERRO CRITICO] Erro durante os testes: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

