// expediente.js — Archivo de personajes: fichas policiales que se completan con la lectura (Fase 3).
// Solo datos, se edita a mano (parser.js nunca lo toca). Ver GUIA-MARCADORES.md, sección 13.
//
// Cómo se revela:
//   - Cada ficha aparece cuando la lectora TERMINA el capítulo de su "desde".
//   - Cada dato tiene su propio "desde": hasta terminar ese capítulo se ve
//     como "████ [clasificado]". Así se puede insinuar poco a poco (por
//     ejemplo, su naturaleza mítica con un "desde" de un capítulo lejano).
//   - Un dato con "desde" de un capítulo que todavía no existe queda
//     clasificado hasta que ese capítulo se publique y se lea.
//
// Por ahora cada ficha solo trae su primera aparición (calculada del texto).
// El resto lo escriben ustedes: copien la línea de ejemplo dentro de "datos".

const CONFIG_EXPEDIENTE = {
  personajes: [
    // Ejemplo completo:
    // {
    //   id: 'zhanshi', nombre: 'Zhanshi', alias: '', imagen: 'assets/expediente/zhanshi.jpg', desde: '02',
    //   datos: [
    //     { etiqueta: 'Ocupación', valor: 'Policía', desde: '02' },
    //     { etiqueta: 'Naturaleza', valor: 'Dragón', desde: '12' }
    //   ]
    // },
    { id: 'xuanwu', nombre: 'Xuanwu', alias: 'La sabia tortuga', imagen: 'assets/expediente/xuanwu.webp', desde: '01', datos: [{ etiqueta: 'Ocupación', valor: 'No desbloqueado', desde: '16' }] },
    { id: 'longgui', nombre: 'Longgui', alias: 'El guardián durmiente', imagen: 'assets/expediente/longgui.webp', desde: '01', datos: [{ etiqueta: 'Ocupación', valor: 'No desbloqueado', desde: '16' }] },
    { id: 'haoyu', nombre: 'Haoyu', alias: 'La serpiente oscura', imagen: 'assets/expediente/haoyu.webp', desde: '01', datos: [{ etiqueta: 'Ocupación', valor: 'Guardaespaldas', desde: '01' }] },
    { id: 'zhanshi', nombre: 'Zhanshi', alias: 'El dragón protector', imagen: 'assets/expediente/zhanshi.webp', desde: '02', datos: [{ etiqueta: 'Ocupación', valor: 'Policía', desde: '02' }] },
    { id: 'yong', nombre: 'Yông', alias: 'El colmillo carmesí', imagen: 'assets/expediente/yong.webp', desde: '04', datos: [{ etiqueta: 'Ocupación', valor: 'Estudiante', desde: '02' }] },
    { id: 'daoji', nombre: 'Daoji', alias: 'El vidente perdido', imagen: 'assets/expediente/daoji.webp', desde: '02', datos: [{ etiqueta: 'Ocupación', valor: 'Indigente', desde: '02' }] },
    { id: 'cai-jin', nombre: 'Cai Jin', alias: 'El genio insomne', imagen: 'assets/expediente/caijin.webp', desde: '03', datos: [{ etiqueta: 'Ocupación', valor: 'Enfermero', desde: '03' }] },
    { id: 'jian-lin', nombre: 'Jian Lin', alias: 'El lobo errante', imagen: 'assets/expediente/jian.webp', desde: '03', datos: [{ etiqueta: 'Ocupación', valor: 'Detective', desde: '03' }] },
    { id: 'kazim', nombre: 'Kazim Al-Hashim', alias: 'El juez iracundo', imagen: '', desde: '06', datos: [{ etiqueta: 'Ocupación', valor: 'Abogado', desde: '16' }] },
    { id: 'he-lin', nombre: 'He Lin', alias: 'El alma bondadosa', imagen: '', desde: '03', datos: [{ etiqueta: 'Ocupación', valor: 'No desbloqueado', desde: '16' }] },
    { id: 'hua-long', nombre: 'Hua Long', alias: 'La flor brillante', imagen: '', desde: '06', datos: [{ etiqueta: 'Ocupación', valor: 'Profesor / Florista', desde: '06' }] },
    { id: 'shen-zao', nombre: 'Shen Zao', alias: 'El temible tigre', imagen: '', desde: '06', datos: [{ etiqueta: 'Ocupación', valor: 'Idol', desde: '06' }] },
    { id: 'xiao-tou', nombre: 'Xiaotou', alias: 'El Áspid letal ', imagen: '', desde: '06', datos: [{ etiqueta: 'Ocupación', valor: 'Periodista', desde: '06' }] }
  ]
};

if (typeof module !== 'undefined') module.exports = CONFIG_EXPEDIENTE;
