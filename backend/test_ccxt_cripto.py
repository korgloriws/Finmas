"""
Teste: recuperar valor atual das 12 principais criptomoedas.
Usa API pública da Binance (sem API key) - mesma fonte que o CCXT usaria.
Sem dependência do ccxt (evita erro de static_dependencies).
Se estiver correto, integramos no sistema no lugar do yfinance para criptos.

Executar: python test_ccxt_cripto.py
Requer: apenas Python 3 (urllib na stdlib).
"""

import json
import urllib.request
from datetime import datetime

# 12 principais criptos (símbolo Binance = base + USDT)
CRIPTO_SYMBOLS = [
    "BTC",   # Bitcoin
    "ETH",   # Ethereum
    "BNB",   # Binance Coin
    "XRP",   # Ripple
    "ADA",   # Cardano
    "SOL",   # Solana
    "DOGE",  # Dogecoin
    "DOT",   # Polkadot
    "MATIC", # Polygon
    "LTC",   # Litecoin
    "AVAX",  # Avalanche
    "LINK",  # Chainlink
]

BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price"


def fetch_binance_prices():
    """Busca preços atuais na Binance (um request para todos os pares)."""
    req = urllib.request.Request(
        BINANCE_TICKER_URL,
        headers={"User-Agent": "Finmas/1.0"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode())
    # data = [ {"symbol": "BTCUSDT", "price": "97234.50"}, ... ]
    return {item["symbol"]: float(item["price"]) for item in data}


def main():
    print("=" * 60)
    print("Teste - Preços atuais das 12 principais criptomoedas")
    print("Fonte: API pública Binance (sem API key)")
    print("=" * 60)

    results = []
    errors = []

    try:
        all_prices = fetch_binance_prices()
    except Exception as e:
        print(f"\nErro ao conectar na Binance: {e}")
        return False

    for base in CRIPTO_SYMBOLS:
        symbol_binance = f"{base}USDT"
        if symbol_binance not in all_prices:
            errors.append((f"{base}/USDT", "Símbolo não encontrado"))
            continue
        price = all_prices[symbol_binance]
        results.append({
            "symbol": f"{base}/USDT",
            "last": price,
        })

    # Exibir resultados
    print(f"\nAtualizado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    print(f"{'Ativo':<12} {'Preço (USDT)':>20}")
    print("-" * 35)
    for r in results:
        last_s = f"{r['last']:,.2f}" if r["last"] >= 0.01 else f"{r['last']:.6f}"
        print(f"{r['symbol']:<12} {last_s:>20}")

    if errors:
        print("\nErros:")
        for sym, msg in errors:
            print(f"  {sym}: {msg}")

    print("\n" + "=" * 60)
    print(f"Total: {len(results)}/12 preços obtidos com sucesso.")
    print("Valores em USDT. No sistema, converteríamos para BRL (ex.: via taxa USD/BRL).")
    print("=" * 60)
    return len(results) == 12 and len(errors) == 0


if __name__ == "__main__":
    ok = main()
    exit(0 if ok else 1)
