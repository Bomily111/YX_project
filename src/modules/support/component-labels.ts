const names:Record<string,string>={primary_concrete:'初支混凝土',secondary_lining:'二次衬砌',steel_arch:'钢拱架',lattice_arch:'格栅拱架',primary_mesh:'初支钢筋网',system_anchor:'系统锚杆',lock_foot_anchor:'锁脚锚杆',advance_support:'超前支护'}
export const supportComponentLabel=(component:string)=>names[component]||component.replace('secondary_rebar_','二衬钢筋 ')
