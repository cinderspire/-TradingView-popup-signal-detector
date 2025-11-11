# -*- coding: utf-8 -*-
"""
Replica of TradingView 7-RSI strategy
inputs:   Source RSI=close | Bot period=2 dakika | Source Bot=ohlc4
          Trade Direction = Long Bot
          Seven RSI periods = 1-5-15-30-60-120-1D (hepsi length = 14)
          Long-TP 0.5 % | Long step-orders 2 %
          RSI-< thresh. = 100 (hepsi)   –>  Buy sinyali daima True
          Short tarafı KAPALI
20 adet limit emri (Long0 … Long19) 5 % equity / emir
Çıkış:  avg_price·1.005 limit
"""

import ccxt, pandas as pd, numpy as np, talib, time, pickle, os, warnings
from datetime import datetime, timedelta
warnings.filterwarnings("ignore")

# ---------- PARAMETRELER ---------------------------------------------------- #
API_KEY    = "gHkfez35svewUz8onhpmnKBGhHIaY5Ht8zt6U6ZVxZ21oJHlMm1gXqaRHqQC5MfI"
API_SECRET = "gGyrz2ICr7ajMZhIMU7bJSRb3RISTIsJUkXKiAZeNIjPIg1oOHu8bqwKGMb1SKuM"

PAIR             = "BANANAS31/USDT:USDT"
DAYS             = 30                           # geçmiş veri
BOT_RES          = "2T"                         # 2-dakika ana bar[2]
RSI_RES_LIST     = ["1T","5T","15T","30T","1H","2H","1D"] # görüntü [1][2]
RSI_LEN          = 14
THRESH_BUY       = 100                          # < 100 → TRUE
TP_PERC          = 0.005                        # 0.5 %
STEP_PERC        = 0.02                         # 2 %
EQ_PERC_PER_ORDER= 0.05                         # %5
MAX_ORDERS       = 20

CACHE_FILE       = "bananas_2m_cache.pkl"
# --------------------------------------------------------------------------- #

class RSIStrategy2M:
    def __init__(self):
        self.ex = ccxt.binance({"apiKey":API_KEY,
                                "secret":API_SECRET,
                                "enableRateLimit":True})
        self.balance  = 10_000.0
        self.pos_qty  = 0.0
        self.pos_avg  = 0.0
        self.open_lims= []          # aktif limit emirleri
        self.trades   = []
        self.equity   = []

    # ------------------ VERİ ------------------------------------------------ #
    def _load_cache(self):
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE,"rb") as f:
                d=pickle.load(f)
            if (datetime.utcnow()-d["ts"]).seconds<1800: return d["df"]
        return None

    def _save_cache(self,df):
        pickle.dump({"df":df,"ts":datetime.utcnow()},open(CACHE_FILE,"wb"))

    def get_data(self):
        df=self._load_cache()
        if df is not None: return df
        since = self.ex.milliseconds()-DAYS*86400*1000
        all=[]
        while True:
            ohlcv=self.ex.fetch_ohlcv(PAIR,"1m",since=since,limit=1000)
            if not ohlcv: break
            all+=ohlcv
            since=ohlcv[-1][0]+60_000
            if len(all)%5000==0: print("⬇",len(all),"x 1m")
            if since>self.ex.milliseconds()-60_000: break
            time.sleep(0.05)
        df=pd.DataFrame(all,columns=["ts","o","h","l","c","v"])
        df["ts"]=pd.to_datetime(df.ts,unit="ms")
        df=df.set_index("ts").sort_index()
        df2=df.resample(BOT_RES,label="left",closed="left").agg(
            {"o":"first","h":"max","l":"min","c":"last","v":"sum"}).dropna()
        df2["ohlc4"]=(df2.o+df2.h+df2.l+df2.c)/4
        self._save_cache(df2)
        return df2

    # ------------------ RSI ------------------------------------------------- #
    def rsi_series(self,base,res):
        if res=="2T":  # ana timeframe
            src=base["c"]
        else:
            tf=base.resample(res,label="left",closed="left").agg({"c":"last"}).dropna()
            src=tf["c"]
        r=talib.RSI(src.values,timeperiod=RSI_LEN)
        out=pd.Series(r,index=src.index).reindex(base.index,method="ffill")
        return out

    def calc_all_rsi(self,df):
        return {f"r{i+1}":self.rsi_series(df,RSI_RES_LIST[i])
                for i in range(7)}

    # ------------------ EMİR İŞLEYİŞİ -------------------------------------- #
    def _place_limit_set(self,price,ts):
        self.open_lims.clear()
        for i in range(MAX_ORDERS):
            lim_p=price*(1-STEP_PERC*i)
            order_val=self.balance*EQ_PERC_PER_ORDER
            qty   =order_val/lim_p
            self.open_lims.append({"id":f"L{i}","p":lim_p,"qty":qty,"filled":False})
        print(f"📌 20 limit emri yerleştirildi @{price:.5f}")

    def _check_fills(self,low,ts):
        for o in self.open_lims:
            if not o["filled"] and low<=o["p"]:
                cost=o["p"]*o["qty"]
                if self.balance<cost: continue
                self.balance-=cost
                self.pos_avg=(self.pos_avg*self.pos_qty+cost)/(self.pos_qty+o["qty"]) \
                              if self.pos_qty>0 else o["p"]
                self.pos_qty+=o["qty"]
                o["filled"]=True
                self.trades.append({"ts":ts,"type":"entry","price":o["p"],
                                    "qty":o["qty"]})
        # filled olmayanlar listede kalır

    def _exit_if_tp(self,high,ts):
        if self.pos_qty==0: return
        tp=self.pos_avg*(1+TP_PERC)
        if high>=tp:
            pnl=(tp-self.pos_avg)*self.pos_qty
            self.balance+=self.pos_qty*tp
            self.trades.append({"ts":ts,"type":"exit","price":tp,
                                "qty":self.pos_qty,"pnl":pnl})
            self.pos_qty=self.pos_avg=0
            self.open_lims.clear()

    # ------------------ SİMÜLASYON ----------------------------------------- #
    def run(self):
        df=self.get_data()
        rsi=self.calc_all_rsi(df)       # 7 adet seri[2]
        print("Bars:",len(df)," | start:",df.index[0])
        for i,row in enumerate(df.itertuples()):
            ts,row=row.Index,row
            # 1) Mevcut limitler -> doldurma
            self._check_fills(row.l,ts)
            # 2) TP kontrolü
            self._exit_if_tp(row.h,ts)
            # 3) Yeni sinyal? (pozisyon yok & limit yok)
            if self.pos_qty==0 and not self.open_lims:
                buy = all(rsi[k].iloc[i] < THRESH_BUY for k in rsi)  # her bar TRUE[2]
                if buy: self._place_limit_set(row.ohlc4,ts)
            # 4) equity kaydı
            eq=self.balance + self.pos_qty*row.c
            self.equity.append(eq)

        # --------------- SONUÇ ---------------- #
        pnl=sum(t.get("pnl",0) for t in self.trades)
        roi=(self.equity[-1]-10_000)/10_000*100
        print("\n==== 2-Dakika 7-RSI Sonuçları ====")
        print(f"İşlem sayısı   : {len([t for t in self.trades if t['type']=='exit'])}")
        print(f"Gerçekleşmiş PnL: ${pnl:,.2f}")
        print(f"Son Bakiye      : ${self.equity[-1]:,.2f}")
        print(f"ROI             : {roi:.2f}%")

if __name__ == "__main__":
    RSIStrategy2M().run()
