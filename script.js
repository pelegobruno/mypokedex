const pokemonGrid = document.getElementById('pokemon-grid');
const searchInput = document.getElementById('search-input');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const closeBtn = document.getElementById('close-btn');

const GEN1_LIMIT = 151;
let allPokemons = [];
let speechTimeout = null;

// Dicionário de Tradução dos Tipos
const typeTranslations = {
  normal: 'Normal',
  fire: 'Fogo',
  water: 'Água',
  grass: 'Planta',
  electric: 'Elétrico',
  ice: 'Gelo',
  fighting: 'Lutador',
  poison: 'Venenoso',
  ground: 'Terrestre',
  flying: 'Voador',
  psychic: 'Psíquico',
  bug: 'Inseto',
  rock: 'Pedra',
  ghost: 'Fantasma',
  dragon: 'Dragão',
  steel: 'Aço',
  fairy: 'Fada'
};

// Mapeamento de Fraquezas por Tipo
const typeWeaknesses = {
  normal: ['fighting'],
  fire: ['water', 'ground', 'rock'],
  water: ['electric', 'grass'],
  grass: ['fire', 'ice', 'poison', 'flying', 'bug'],
  electric: ['ground'],
  ice: ['fire', 'fighting', 'rock', 'steel'],
  fighting: ['flying', 'psychic', 'fairy'],
  poison: ['ground', 'psychic'],
  ground: ['water', 'grass', 'ice'],
  flying: ['electric', 'ice', 'rock'],
  psychic: ['bug', 'ghost'],
  bug: ['fire', 'flying', 'rock'],
  rock: ['water', 'grass', 'fighting', 'ground', 'steel'],
  ghost: ['ghost'],
  dragon: ['ice', 'dragon', 'fairy'],
  fairy: ['poison', 'steel']
};

// Carrega os 151 Pokémon
async function fetchGen1Pokemons() {
  for (let i = 1; i <= GEN1_LIMIT; i++) {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${i}`);
    const data = await response.json();
    allPokemons.push(data);
    renderCard(data);
  }
}

// Renderiza o card principal
function renderCard(pokemon) {
  const card = document.createElement('div');
  card.classList.add('card');
  
  const mainType = pokemon.types[0].type.name;
  card.classList.add(`bg-${mainType}`);

  const imageUrl = pokemon.sprites.other['official-artwork'].front_default;
  
  const typesHtml = pokemon.types
    .map(t => {
      const typeName = typeTranslations[t.type.name] || t.type.name;
      return `<span class="type-badge type-${t.type.name}">${typeName}</span>`;
    })
    .join('');

  card.innerHTML = `
    <span class="number">#${String(pokemon.id).padStart(3, '0')}</span>
    <img src="${imageUrl}" alt="${pokemon.name}" loading="lazy">
    <h3 class="name">${pokemon.name}</h3>
    <div class="types-container" style="justify-content: center;">${typesHtml}</div>
  `;

  card.addEventListener('click', () => openModal(pokemon));
  pokemonGrid.appendChild(card);
}

// Função para buscar e montar a cadeia evolutiva
async function getEvolutionChain(pokemonId) {
  try {
    const speciesResp = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`);
    const speciesData = await speciesResp.json();
    
    const evoResp = await fetch(speciesData.evolution_chain.url);
    const evoData = await evoResp.json();

    let chain = [];
    let current = evoData.chain;

    while (current) {
      const parts = current.species.url.split('/').filter(Boolean);
      const id = parseInt(parts[parts.length - 1]);

      if (id <= GEN1_LIMIT) {
        chain.push({
          name: current.species.name,
          id: id
        });
      }

      if (current.evolves_to.length > 1) {
        current.evolves_to.forEach(evo => {
          const evoParts = evo.species.url.split('/').filter(Boolean);
          const evoId = parseInt(evoParts[evoParts.length - 1]);
          if (evoId <= GEN1_LIMIT && !chain.find(p => p.id === evoId)) {
            chain.push({ name: evo.species.name, id: evoId });
          }
        });
        break;
      } else {
        current = current.evolves_to[0];
      }
    }
    return chain;
  } catch (err) {
    console.error("Erro ao carregar evoluções:", err);
    return [];
  }
}

// Abre o Modal
async function openModal(pokemon) {
  clearTimeout(speechTimeout);
  window.speechSynthesis.cancel();

  const mainType = pokemon.types[0].type.name;
  const imageUrl = pokemon.sprites.other['official-artwork'].front_default;

  const typesHtml = pokemon.types
    .map(t => {
      const typeName = typeTranslations[t.type.name] || t.type.name;
      return `<span class="type-badge type-${t.type.name}">${typeName}</span>`;
    })
    .join('');

  let weaknessesList = [];
  pokemon.types.forEach(t => {
    const w = typeWeaknesses[t.type.name] || [];
    weaknessesList = [...weaknessesList, ...w];
  });
  const uniqueWeaknesses = [...new Set(weaknessesList)];

  const weaknessesHtml = uniqueWeaknesses
    .map(w => {
      const typeName = typeTranslations[w] || w;
      return `<span class="type-badge type-${w}">${typeName}</span>`;
    })
    .join('');

  const statNamesPT = {
    hp: 'PS',
    attack: 'Ataque',
    defense: 'Defesa',
    'special-attack': 'Atq. Esp.',
    'special-defense': 'Def. Esp.',
    speed: 'Velocidade'
  };

  const statsHtml = pokemon.stats.map(s => {
    const statPercent = Math.min((s.base_stat / 150) * 100, 100);
    const labelPT = statNamesPT[s.stat.name] || s.stat.name.toUpperCase();
    return `
      <div class="stat-row">
        <span class="stat-name">${labelPT}</span>
        <span class="stat-value">${s.base_stat}</span>
        <div class="stat-bar-bg">
          <div class="stat-bar-fill" style="width: ${statPercent}%;"></div>
        </div>
      </div>
    `;
  }).join('');

  // Monta a estrutura inicial do Modal com id na imagem para facilitar a troca
  modalBody.innerHTML = `
    <div class="modal-card-layout">
      <div class="card-left-column bg-${mainType}">
        <img id="modal-pokemon-img" src="${imageUrl}" alt="${pokemon.name}">
        <h2 style="text-transform: capitalize; margin-top: 10px; font-size: 1.4rem; color: #fff;">
          ${pokemon.name}
        </h2>
        <span style="font-weight: bold; opacity: 0.85; font-size: 0.9rem; color: #fff;">
          #${String(pokemon.id).padStart(3, '0')}
        </span>
      </div>

      <div class="card-right-column">
        <div class="tab-container">
          <button class="tab-btn active" onclick="switchTab('about')">Sobre</button>
          <button class="tab-btn" onclick="switchTab('stats')">Estatísticas</button>
          <button class="tab-btn" onclick="switchTab('evolutions')">Evoluções</button>
        </div>

        <!-- Aba Sobre -->
        <div id="tab-about" class="tab-content active">
          <div class="info-text" style="margin: 8px 0 16px; font-size: 0.9rem; color: #ccc;">
            <p style="margin-bottom: 6px;"><strong>Altura:</strong> ${pokemon.height / 10} m</p>
            <p><strong>Peso:</strong> ${pokemon.weight / 10} kg</p>
          </div>
          <div style="margin-top: 12px;">
            <p style="font-size: 0.8rem; margin-bottom: 6px; opacity: 0.8; font-weight: bold;">TIPO</p>
            <div class="types-container">${typesHtml}</div>
          </div>
          <div style="margin-top: 16px;">
            <p style="font-size: 0.8rem; margin-bottom: 6px; opacity: 0.8; font-weight: bold;">FRAQUEZAS</p>
            <div class="types-container">${weaknessesHtml}</div>
          </div>
        </div>

        <!-- Aba Estatísticas -->
        <div id="tab-stats" class="tab-content">
          <div class="stats-container">${statsHtml}</div>
        </div>

        <!-- Aba Evoluções -->
        <div id="tab-evolutions" class="tab-content">
          <div id="evolution-container" class="evolution-container">
            <p style="font-size: 0.85rem; color: #aaa;">Carregando evoluções...</p>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('show');

  // Agenda narração da PokéDex e a troca para o GIF
  speechTimeout = setTimeout(() => {
    speakPokemonName(pokemon);
  }, 1000);

  // Busca e renderiza as evoluções dinamicamente
  const evoChain = await getEvolutionChain(pokemon.id);
  renderEvolutionsUI(evoChain);
}

// Renderiza evoluções
function renderEvolutionsUI(chain) {
  const container = document.getElementById('evolution-container');
  if (!container) return;

  if (chain.length <= 1) {
    container.innerHTML = `<p style="font-size: 0.9rem; color: #aaa; text-align: center; margin-top: 20px;">Este Pokémon não possui evoluções.</p>`;
    return;
  }

  let html = '';
  chain.forEach((item, index) => {
    const fullPokemonData = allPokemons.find(p => p.id === item.id);
    const imgUrl = fullPokemonData 
      ? fullPokemonData.sprites.other['official-artwork'].front_default 
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${item.id}.png`;

    const typesHtml = fullPokemonData ? fullPokemonData.types.map(t => {
      const typeName = typeTranslations[t.type.name] || t.type.name;
      return `<span class="type-badge type-${t.type.name}" style="font-size: 0.6rem; padding: 2px 8px;">${typeName}</span>`;
    }).join('') : '';

    html += `
      <div class="evolution-node" onclick="navigateToPokemon(${item.id})">
        <div class="evolution-circle">
          <img src="${imgUrl}" alt="${item.name}">
        </div>
        <span class="evolution-name">${item.name}</span>
        <span class="evolution-number">#${String(item.id).padStart(4, '0')}</span>
        <div class="types-container" style="justify-content: center; margin-top: 4px;">${typesHtml}</div>
      </div>
    `;

    if (index < chain.length - 1) {
      html += `<div class="evolution-arrow">❯</div>`;
    }
  });

  container.innerHTML = html;
}

function navigateToPokemon(pokemonId) {
  const targetPokemon = allPokemons.find(p => p.id === pokemonId);
  if (targetPokemon) {
    openModal(targetPokemon);
  }
}

function getPokedexVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find(voice => 
    voice.lang.includes('pt-BR') && 
    (voice.name.includes('Daniel') || voice.name.includes('Ricardo') || voice.name.includes('Male') || voice.name.includes('Google'))
  ) || voices.find(voice => voice.lang.includes('pt-BR'));
}

if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = getPokedexVoice;
}

// Narração da PokéDex + Transição para GIF
function speakPokemonName(pokemon) {
  window.speechSynthesis.cancel();

  // Troca a imagem estática para o GIF Animado se existir
  const gifUrl = pokemon.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default 
              || pokemon.sprites.other?.showdown?.front_default;
              
  const modalImg = document.getElementById('modal-pokemon-img');

  if (modalImg && gifUrl) {
    modalImg.src = gifUrl;
  }

  const typesPT = pokemon.types
    .map(t => typeTranslations[t.type.name] || t.type.name)
    .join(' e ');

  const pokedexText = `${pokemon.name}. Pokémon do tipo ${typesPT}.`;

  const utterance = new SpeechSynthesisUtterance(pokedexText);
  utterance.lang = 'pt-BR';
  utterance.rate = 0.88; 
  utterance.pitch = 0.85;

  const selectedVoice = getPokedexVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// Troca de Abas
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  const btnIndex = tabName === 'about' ? 0 : tabName === 'stats' ? 1 : 2;
  document.querySelectorAll('.tab-btn')[btnIndex].classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

// Eventos do Modal
closeBtn.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

function closeModal() {
  modal.classList.remove('show');
  clearTimeout(speechTimeout);
  window.speechSynthesis.cancel();
}

// Filtro de Busca
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  pokemonGrid.innerHTML = '';
  
  const filtered = allPokemons.filter(p => 
    p.name.toLowerCase().includes(query) || String(p.id).includes(query)
  );

  filtered.forEach(renderCard);
});

// Inicialização
fetchGen1Pokemons();