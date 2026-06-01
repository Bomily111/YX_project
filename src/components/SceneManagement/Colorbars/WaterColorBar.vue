<template>
  <div class="out_rectangle">
    <div class="jojo"></div>
    <div class="triangle1"></div>
    <div class="triangle2"></div>
    <div class="triangle3"></div>
    <div class="text1">0</div>
    <div class="text2">50</div>
    <div class="text3">100</div>
    <div class="text4">水占比/%</div>
  </div>
</template>

<script setup>
</script>

<style lang="scss" scoped>
.out_rectangle {
  position: fixed;
  width: 15%;
  height: 30%;
  top: 44%;
  right: 1%;

  .jojo {
    position: absolute;
    width: 90%;
    height: 40px;
    top: 0%;
    left: 5%;
    background-image: linear-gradient(to right, rgba(128, 128, 105, 0.5), rgba(135, 206, 235, 1), rgba(0, 255, 255, 1));
  }

  .triangle1 {
    position: absolute;
    height: 0;
    width: 0;
    top: -5%;
    left: 1.8%;
    font-size: 0;
    line-height: 0;
    border: 10px solid transparent;
    border-top-color: rgba(128, 138, 135, 0.5);
  }

  .triangle2 {
    position: absolute;
    height: 0;
    width: 0;
    top: -5%;
    left: 48.8%;
    font-size: 0;
    line-height: 0;
    border: 10px solid transparent;
    border-top-color: rgba(135, 206, 235, 1);
  }

  .triangle3 {
    position: absolute;
    height: 0;
    width: 0;
    top: -5%;
    left: 90.8%;
    font-size: 0;
    line-height: 0;
    border: 10px solid transparent;
    border-top-color: rgba(0, 255, 255, 1);
  }

  .text1 {
    position: absolute;
    top: -18%;
    left: 3%;
    font-size: 12px;
    color: white;
  }

  .text2 {
    position: absolute;
    top: -18%;
    left: 48%;
    font-size: 12px;
    color: white;
  }

  .text3 {
    position: absolute;
    top: -18%;
    left: 88%;
    font-size: 12px;
    color: white;
  }

  .text4 {
    position: absolute;
    top: 55px;
    left: 30%;
    font-size: 12px;
    color: white;
  }
}
</style>
