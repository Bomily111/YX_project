# 智能体动态场景装配

智能体从施工任务中提取目标 YK 里程和展示需求，调用 `assemble_scene_at_mileage`。平台校验资源、里程与同屏组合后，在主场景装配并保存任务快照；明确只要求计划时使用 `compose_scene_workflow`。

| 资源 | 用途 |
| --- | --- |
| `rock.design-grade` | 设计围岩分级 |
| `rock.geophysical-grade`、`rock.tsp-hardness`、`rock.tsp-integrity`、`rock.tem-resistivity` | 物探解释层，按任务语义选择；四层互斥 |
| `support.modeler-zz-va` | 新支护模块已导出的 ZZ-Va 1 m 断面，默认支护组合 |
| `support.modeler-zz-*` | 用户指定其他已交付的 ZZ 支护类型时选择对应断面 |
| `blast.effect` | 爆破效果 |
| `ventilation.steady-cfd`、`ventilation.transient-network`、`ventilation.thermal-field` | 通风示例工况 |

支护断面在平台 YK 中线目标里程放置，设计高程点映射到中线位置。任务快照记录实际使用的 GLB 内容指纹。当前装配的是已导出模型，尚未按对话参数重新生成构件；也不能把示例数据解释为目标工点实测或质量结论。

旧结构树支护已从智能体白名单、场景模块注册表和当前任务面板入口移除。历史任务的文字与快照继续保留供查阅，旧模型不再作为新任务资源加载。
