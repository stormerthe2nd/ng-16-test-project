import { Component, OnInit } from '@angular/core';

declare var loadPyodide: any;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})

export class HomeComponent implements OnInit {
  scriptLoadStatus: string = "NOT_LOADED"
  pyodide: any
  input = {
    mode: 'get_black_schole_ltp',
    iv: 0.1662,
    underlying: 17743,
    strike: 17700,
    diff_days: 1,
    opt_typ: 'c',
  }

  constructor() {
    this.loadScript()
  }

  ngOnInit(): void {
    setTimeout(() => {
      console.log(this.calculateStopLossPy())
    }, 1000)
    setTimeout(() => {
      console.log(this.calculateStopLossPy())
    }, 2000)
  }

  calculateStopLossPy():number{
    let resFromPy = this.pyodide.runPython(`get_main_data(json.dumps(${JSON.stringify(this.input)}))`)
    return JSON.parse(resFromPy)?.projected_ltp
  }

  loadScript(): void {
    var script = document.createElement("script");
    script.setAttribute("src", "https://cdn.jsdelivr.net/pyodide/v0.23.2/full/pyodide.js");
    script.addEventListener("load", async () => {
      this.scriptLoadStatus = "LOADING"
      this.pyodide = await loadPyodide();
      this.pyodide.runPython(`
      import json
      import math
      import traceback
      import statistics
      from typing import Union, Literal
      from dataclasses import dataclass
      ALLOWED_MODES = {
          'get_black_schole_ltp': {},
      }
      def get_main_data(event: dict[str]) -> str:
          try:
              final_resp = EventProcessor(event).get_data()

          except Exception:
              final_resp = {
                  'status': 0,
                  'msg': json.dumps(traceback.format_exc())
              }
          finally:
              return json.dumps(final_resp)
      class EventProcessor:
          def __init__(self, event: dict[str]) -> None:
              # UI facing some issue on sending some data type like map object, so receiving data via json string
              self.event = json.loads(event)
          def get_data(self) -> dict[str]:
              if (mode := self.event.get('mode')) not in ALLOWED_MODES:
                  return {
                      'status': 0,
                      'msg': f"Invalid mode -> {mode}"
                  }
              elif mode == 'get_black_schole_ltp':
                  return self._get_projected_ltp()
          def _get_projected_ltp(self):
              projected_ltp = ProjectedData(
                  iv=self.event['iv'],
                  opt_typ=self.event['opt_typ'],
              ).get_projected_ltp(
                  spot_price=self.event['underlying'],
                  target_strike=self.event['strike'],
                  diff_days=self.event['diff_days'],
              )
              return {
                  'status': 1,
                  'projected_ltp': projected_ltp,
              }
      @dataclass
      class ProjectedData:
          iv: float
          opt_typ: Literal['c', 'p']
          def get_projected_ltp(self, spot_price: Union[int, float], target_strike: Union[int, float], diff_days: int) -> float:
              if self.iv != 0 and diff_days > 0:
                  return self._black_scholes_data(spot_price, target_strike, diff_days)
              if self.opt_typ == 'c':
                  return max(spot_price - target_strike, 0)
              else:
                  return max(target_strike - spot_price, 0)
          def _black_scholes_data(self, spot_price: Union[int, float], target_strike: Union[int, float], diff_days: int) -> float:
              time_to_mature = diff_days / 365
              d1 = (math.log(spot_price/target_strike) + ((self.iv**2)/2)*time_to_mature) / (self.iv*math.sqrt(time_to_mature))
              d2 = d1 - self.iv * math.sqrt(time_to_mature)
              if self.opt_typ == 'c':
                  return (spot_price*self._get_cnd_value(d1)) - (target_strike*self._get_cnd_value(d2))
              elif self.opt_typ == 'p':
                  return (target_strike*self._get_cnd_value(-d2)) - (spot_price*self._get_cnd_value(-d1))
          def _get_cnd_value(self, x: Union[int, float]) -> float:
              return statistics.NormalDist().cdf(x)   
      `)
      this.scriptLoadStatus = "LOADED"
    });
    document.getElementsByTagName("script")[0].insertBefore(script, null)
  }

}
