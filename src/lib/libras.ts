export interface Sign {
  letter: string;
  description: string;
}

// Alfabeto manual da Libras — descrição de como configurar a mão.
export const alphabet: Sign[] = [
  { letter: "A", description: "Mão fechada em punho, com o polegar ao lado dos dedos." },
  { letter: "B", description: "Mão aberta, dedos estendidos e juntos, polegar dobrado sobre a palma." },
  { letter: "C", description: "Mão curvada formando a letra C." },
  { letter: "D", description: "Indicador apontando para cima, demais dedos tocando o polegar." },
  { letter: "E", description: "Dedos dobrados sobre a palma, pontas tocando o polegar." },
  { letter: "F", description: "Indicador e polegar unidos em círculo, demais dedos estendidos." },
  { letter: "G", description: "Indicador e polegar estendidos na horizontal, formando um G." },
  { letter: "H", description: "Indicador e médio estendidos juntos na horizontal." },
  { letter: "I", description: "Mão fechada com o dedo mínimo estendido para cima." },
  { letter: "J", description: "Dedo mínimo estendido desenhando um J no ar." },
  { letter: "K", description: "Indicador e médio em V com o polegar entre eles." },
  { letter: "L", description: "Indicador para cima e polegar para o lado, formando um L." },
  { letter: "M", description: "Três dedos dobrados sobre o polegar." },
  { letter: "N", description: "Dois dedos dobrados sobre o polegar." },
  { letter: "O", description: "Todos os dedos curvados formando um círculo." },
  { letter: "P", description: "Como o K, porém apontado para baixo." },
  { letter: "Q", description: "Como o G, porém apontado para baixo." },
  { letter: "R", description: "Indicador e médio cruzados." },
  { letter: "S", description: "Mão fechada em punho com o polegar à frente dos dedos." },
  { letter: "T", description: "Punho fechado com o polegar entre o indicador e o médio." },
  { letter: "U", description: "Indicador e médio estendidos juntos para cima." },
  { letter: "V", description: "Indicador e médio estendidos e separados em V." },
  { letter: "W", description: "Indicador, médio e anelar estendidos e separados." },
  { letter: "X", description: "Indicador dobrado em forma de gancho." },
  { letter: "Y", description: "Polegar e mínimo estendidos, demais dedos fechados." },
  { letter: "Z", description: "Indicador desenhando um Z no ar." },
];

export const numbers: Sign[] = [
  { letter: "1", description: "Apenas o indicador estendido para cima." },
  { letter: "2", description: "Indicador e médio estendidos." },
  { letter: "3", description: "Polegar, indicador e médio estendidos." },
  { letter: "4", description: "Quatro dedos estendidos, polegar dobrado." },
  { letter: "5", description: "Mão aberta com todos os dedos estendidos." },
];
