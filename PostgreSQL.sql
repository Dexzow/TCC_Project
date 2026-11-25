CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL
        CHECK (tipo IN ('jovem', 'empregador')),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE perfis_jovens (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER UNIQUE NOT NULL
        REFERENCES usuarios(id),
    descricao TEXT,
    cidade VARCHAR(100),
    telefone VARCHAR(20)
);

CREATE TABLE empregadores (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER UNIQUE NOT NULL
        REFERENCES usuarios(id),
    nome_empresa VARCHAR(150) NOT NULL,
    descricao TEXT,
    cidade VARCHAR(100)
);

CREATE TABLE vagas (
    id SERIAL PRIMARY KEY,
    empregador_id INTEGER NOT NULL
        REFERENCES empregadores(id),
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT NOT NULL,
    modalidade VARCHAR(30),
    status VARCHAR(20) DEFAULT 'aberta',
    criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidaturas (
    id SERIAL PRIMARY KEY,
    jovem_id INTEGER NOT NULL
        REFERENCES perfis_jovens(id),
    vaga_id INTEGER NOT NULL
        REFERENCES vagas(id),
    status VARCHAR(30) DEFAULT 'pendente',
    data_candidatura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(jovem_id, vaga_id)
);

CREATE TABLE habilidades (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE jovem_habilidades (
    id SERIAL PRIMARY KEY,
    jovem_id INTEGER NOT NULL
        REFERENCES perfis_jovens(id),
    habilidade_id INTEGER NOT NULL
        REFERENCES habilidades(id),
    nivel VARCHAR(30),
    UNIQUE(jovem_id, habilidade_id)
);

CREATE TABLE avaliacoes (
    id SERIAL PRIMARY KEY,
    candidatura_id INTEGER UNIQUE NOT NULL
        REFERENCES candidaturas(id),
    nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
    comentario TEXT
);

CREATE TABLE notificacoes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL
        REFERENCES usuarios(id),
    titulo VARCHAR(150) NOT NULL,
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
