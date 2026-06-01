<template>
  <div id="volume-container">
    <div id="hidden" style="display: none">
      <canvas id="gradient" width="2048" height="1" />
    </div>

    <div id="info" class="toolbox">
      <div>
        <h3 id="status">Loading...</h3>
      </div>
    </div>

    <div id="colourmap" class="toolbox">
      <div>
        <div class="toolclose" onclick="window.colourmaps.hide();">&times;</div>
        <h3>Colourmaps:</h3>
        <hr />
        <select id="colourmaps" @onchange="colourChanged(value)">
          <option value="" selected>None</option>
          <option value="#000000;#ffffff">Black-White</option>
          <option value="#ffffff;#000000">White-Black</option>
          <option
            value="0.0=rgba(59,76,192,1.0);0.117647=rgba(95,127,232,1.0);0.235294=rgba(135,171,253,1.0);0.352941=rgba(176,203,252,1.0);0.5=rgba(220,220,220,1.0);0.529412=rgba(228,217,211,1.0);0.647059=rgba(246,191,165,1.0);0.764706=rgba(243,149,118,1.0);0.882353=rgba(221,94,75,1.0);1.0=rgba(181,11,39,1.0)"
          >
            Cool-Warm
          </option>
          <option value="0.0=rgba(0,0,0,1.0);0.5=rgba(255,0,0,1.0);0.75=rgba(255,127,0,1.0);1.000000=rgba(255,255,255,1.0)">Hot iron</option>
          <option
            value="rgba(0,0,0,1.0);rgba(85,0,170,1.0);rgba(5,0,90,1.0);rgba(0,0,159,1.0);rgba(0,0,239,1.0);rgba(0,63,255,1.0);rgba(0,143,196,1.0);rgba(0,223,170,1.0);rgba(0,255,74,1.0);rgba(42,255,42,1.0);rgba(159,255,47,1.0);rgba(255,223,0,1.0);rgba(255,143,0,1.0);rgba(255,71,0,1.0);rgba(255,22,0,1.0);rgba(237,0,0,1.0);rgba(203,0,0,1.0);rgba(0,0,0,1.0)"
          >
            NIH
          </option>
          <option value="#ff00ff;#0000ff;#00ffff;#00ff00;#ffff00;#ff0000">Spectrum</option>
        </select>
        <br />
        <canvas id="palette" width="512" height="24" class="palette checkerboard"></canvas>

        <div id="backgroundBG" class="colourbg checkerboard">
          <div id="backgroundCUR" class="colour" onmousedown="backgroundChanged($('backgroundCUR'))"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { initVolume, updateColourmap } from './ShareVolume01.js';
import Previous from '../index.js';

onMounted(() => {
  initVolume();
});
function colourChanged(params) {
  Previous.SVData[2].read(params);
  updateColourmap();
}
function backgroundChanged(params) {
  Previous.SVData[2].editBackground(params);
}
// export default {
//   mounted() {
//     initVolume();
//   },
//   methods: {
//     colourChanged: function (params) {
//       SVData[2].read(params);
//       updateColourmap();
//     },

//     backgroundChanged: function (params) {
//       SVData[2].editBackground(params);
//     }
//   }
// }
</script>

<style lang="scss" scoped>
#volume-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.palette {
  z-index: 0;
  margin: 0;
  padding: 0;
  border: 1px solid #000;
}

.checkerboard {
  background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVQ4jWP4TwAcOHAAL2YYNWBYGEBIASEwasCwMAAALvidroqDalkAAAAASUVORK5CYII=');
}

#colourmap {
  pointer-events: all;
}

/* Background colour */
#backgroundBG {
  float: left;
  width: 24px;
  height: 24px;
  margin: 0 2px 0 0;
}

#backgroundCUR {
  float: left;
  width: 24px;
  height: 24px;
}

/* Colour select */
.colourbg {
  width: 100px;
  height: 20px;
  margin: 1px;
  border: solid 1px;
}

.toolbox {
  visibility: hidden;
  position: absolute;
  z-index: 20;
  min-width: 300px;
  max-height: 400px;
  padding: 7px 10px 11px;
  border: 1px solid #444;
  color: #000;
  background: #bba;
}

.scroll {
  max-height: 330px;
  overflow-y: auto;
}

.toolclose {
  float: right;
  margin: 0;
  padding: 0 4px;
  border: none;
  line-height: 16px;
  color: #333;
  font-size: 14pt;
  font-weight: bold;
}

.toolbox h3 {
  display: inline;
  margin: 2px 0;
  padding: 0;
  font-size: 10pt;
  font-weight: bold;
}
</style>
