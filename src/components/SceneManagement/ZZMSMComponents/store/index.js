/*
 * @Author: xiongxu
 * @Date: 2024-04-14 11:37:12
 * @LastEditTime: 2024-04-14 11:37:12
 * @LastEditors: xiongxu
 * @Description: Please Describe The File.
 * @FilePath: \Geo—毕设\src\views\ZZMSMComponents\store\index.js
 */
import { createStore } from 'vuex';

// define state object
const state = {
  rockIntegrityState : {mileage : [], value : []},
  rockStrength : {mileage : [], value : []},
  hardness : {mileage : [], value : []},
  weatheringDegree : {mileage : [], value : []},
  fissureState : {mileage : [], value : []},
  //绘制设计围岩级别和建议围岩级别的叠加
  rockLevel : {mileage : [], value : [],designValue : []},
  //风险类别用以统计
  riskLevel : {mileage : [], value : [],type : []}
};

// define modification method
const mutations = {
  // 修改 rockIntegrityState 的 mileage 和 value  
    SET_ROCK_INTEGRITY_MILEAGE(state, mileage) {  
      state.rockIntegrityState.mileage = mileage;  
    },  
    SET_ROCK_INTEGRITY_VALUE(state, value) {  
      state.rockIntegrityState.value = value;  
    },  
      
    // 修改 rockStrength 的 mileage 和 value  
    SET_ROCK_STRENGTH_MILEAGE(state, mileage) {  
      state.rockStrength.mileage = mileage;  
    },  
    SET_ROCK_STRENGTH_VALUE(state, value) {  
      state.rockStrength.value = value;  
    },  
      
    // 修改 hardness 的 mileage 和 value  
    SET_HARDNESS_MILEAGE(state, mileage) {  
      state.hardness.mileage = mileage;  
    },  
    SET_HARDNESS_VALUE(state, value) {  
      state.hardness.value = value;  
    },  
      
    // 修改 weatheringDegree 的 mileage 和 value  
    SET_WEATHERING_DEGREE_MILEAGE(state, mileage) {  
      state.weatheringDegree.mileage = mileage;  
    },  
    SET_WEATHERING_DEGREE_VALUE(state, value) {  
      state.weatheringDegree.value = value;  
    },  
      
    // 修改 fissureState 的 mileage 和 value  
    SET_FISSURE_STATE_MILEAGE(state, mileage) {  
      state.fissureState.mileage = mileage;  
    },  
    SET_FISSURE_STATE_VALUE(state, value) {  
      state.fissureState.value = value;  
    },  
      
    // 修改 rockLevel 的 mileage、designValue 和 value  
    SET_ROCK_LEVEL_MILEAGE(state, mileage) {  
      state.rockLevel.mileage = mileage;  
    },  
    SET_ROCK_LEVEL_DESIGN_VALUE(state, designValue) {  
      state.rockLevel.designValue = designValue;  
    },  
    SET_ROCK_LEVEL_ADVISE_VALUE(state, value) {  
      state.rockLevel.value = value;  
    },  
      
    // 修改 riskLevel 的 mileage、value 和 type  
    SET_RISK_LEVEL_MILEAGE(state, mileage) {  
      state.riskLevel.mileage = mileage;  
    },  
    SET_RISK_LEVEL_VALUE(state, value) {  
      state.riskLevel.value = value;  
    },  
    SET_RISK_LEVEL_TYPE(state, type) {  
      state.riskLevel.type = type;  
    },  
};

// 创建 Vuex store
const store = createStore({
  // 初始状态
  state() {
    return state;
  },
  // 修改状态的 mutations
  mutations: mutations
});

export default store;
