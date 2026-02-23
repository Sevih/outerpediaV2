import type { NodeType } from '@/types/monad';

export const nodeTypes = {
  start: {
    label: 'Start',
    icon: 'CM_Monad_Node_Icon_01',
    textColor: 'text-yellow-400',
  },
  tending: {
    label: 'True Ending',
    icon: 'CM_Monad_Node_Icon_01',
    textColor: 'text-yellow-400',
  },
  bending: {
    label: 'Bad Ending',
    icon: 'CM_Monad_Node_Icon_01',
    textColor: 'text-yellow-400',
  },
  nending: {
    label: 'Normal Ending',
    icon: 'CM_Monad_Node_Icon_01',
    textColor: 'text-yellow-400',
  },
  path: {
    label: 'Path',
    icon: 'CM_Monad_Node_Icon_08',
    textColor: 'text-yellow-400',
  },
  relic: {
    label: 'Relic Excavation',
    icon: 'CM_Monad_Node_Icon_05',
    textColor: 'text-green-400',
  },
  moment: {
    label: 'Moment of Maintenance',
    icon: 'CM_Monad_Node_Icon_03',
    textColor: 'text-green-400',
  },
  combat: {
    label: 'Combat Encounter',
    icon: 'CM_Monad_Node_Icon_02',
    textColor: 'text-red-400',
  },
  elite: {
    label: 'Encounter with Elite',
    icon: 'CM_Monad_Node_Icon_04',
    textColor: 'text-red-400',
  },
  eldritch: {
    label: 'Eldritch Realm',
    icon: 'CM_Monad_Node_Icon_09',
    textColor: 'text-sky-400',
  },
  pinnacle: {
    label: 'Pinnacle of the Worldline',
    icon: 'CM_Monad_Node_Icon_06',
    textColor: 'text-red-400',
  },
  final: {
    label: 'Final Gateway',
    icon: 'CM_Monad_Node_Icon_07',
    textColor: 'text-red-400',
  },
  saga: {
    label: 'The Saga of Worldline',
    icon: 'CM_Monad_Node_Icon_10',
    textColor: 'text-sky-400',
  },
  unknown: {
    label: '???',
    icon: 'CM_Monad_Node_Icon_11',
    textColor: 'text-white',
  },
} as const;

export const nodeColorFilters: Record<NodeType, string> = {
  start: 'invert(17%) sepia(92%) saturate(5888%) hue-rotate(353deg) brightness(87%) contrast(132%)',
  tending: 'invert(17%) sepia(92%) saturate(5888%) hue-rotate(353deg) brightness(87%) contrast(132%)',
  bending: 'invert(17%) sepia(92%) saturate(5888%) hue-rotate(353deg) brightness(87%) contrast(132%)',
  nending: 'invert(17%) sepia(92%) saturate(5888%) hue-rotate(353deg) brightness(87%) contrast(132%)',
  path: 'invert(17%) sepia(92%) saturate(5888%) hue-rotate(353deg) brightness(87%) contrast(132%)',
  relic: 'invert(43%) sepia(93%) saturate(512%) hue-rotate(75deg) brightness(90%) contrast(92%)',
  moment: 'invert(41%) sepia(93%) saturate(480%) hue-rotate(65deg) brightness(95%) contrast(89%)',
  combat: 'invert(86%) sepia(131%) saturate(2884%) hue-rotate(348deg) brightness(107%) contrast(96%)',
  elite: 'invert(86%) sepia(131%) saturate(2884%) hue-rotate(348deg) brightness(107%) contrast(96%)',
  final: 'invert(86%) sepia(131%) saturate(2884%) hue-rotate(348deg) brightness(107%) contrast(96%)',
  pinnacle: 'invert(86%) sepia(131%) saturate(2884%) hue-rotate(348deg) brightness(107%) contrast(96%)',
  eldritch: 'invert(44%) sepia(79%) saturate(1538%) hue-rotate(163deg) brightness(98%) contrast(94%)',
  saga: 'invert(44%) sepia(79%) saturate(1538%) hue-rotate(163deg) brightness(98%) contrast(94%)',
  unknown: 'invert(0%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)',
};
