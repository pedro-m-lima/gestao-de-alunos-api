import '../src/database/db.js';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { expect } from 'chai';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Matricula from '../src/models/matricula.model.js';
import { loginComoAdmin, loginComoAluno } from './helpers/login.js';

const alunos = JSON.parse(readFileSync(new URL('./data/alunos.json', import.meta.url)));
const alunosCriados = [];
let tokenAdmin;

describe('Gestao de alunos', () => {
  before(async () => {
    const resposta = await loginComoAdmin(app);
    expect(resposta.status).to.equal(200);
    tokenAdmin = resposta.body.token;
  });

  it('permite o login do administrador', () => {
    expect(tokenAdmin).to.be.a('string').and.not.empty;
  });

  alunos.forEach((aluno) => {
    it(`cadastra o aluno ${aluno.nome}`, async () => {
      const resposta = await request(app)
        .post('/api/admin/alunos')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          nome: aluno.nome,
          email: aluno.email,
          matricula: aluno.matricula,
          senha: aluno.senha,
        });

      expect(resposta.status).to.equal(201);
      expect(resposta.body).to.include({
        nome: aluno.nome,
        email: aluno.email,
        matricula: aluno.matricula,
      });

      alunosCriados.push({ ...aluno, id: resposta.body.id });

      const matricula = await request(app)
        .post(`/api/admin/disciplinas/${aluno.disciplinaId}/matriculas`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ alunoId: resposta.body.id });

      expect(matricula.status).to.equal(201);
    });

    it(`permite o login do aluno ${aluno.nome}`, async () => {
      const alunoCriado = alunosCriados.find(({ email }) => email === aluno.email);
      const resposta = await loginComoAluno(app, alunoCriado);

      expect(resposta.status).to.equal(200);
      expect(resposta.body.token).to.be.a('string').and.not.empty;
      alunoCriado.token = resposta.body.token;
    });

    it(`registra a entrega do trabalho de ${aluno.nome}`, async () => {
      const alunoCriado = alunosCriados.find(({ email }) => email === aluno.email);
      const resposta = await request(app)
        .post(`/api/alunos/${alunoCriado.id}/trabalhos`)
        .set('Authorization', `Bearer ${alunoCriado.token}`)
        .send({
          disciplinaId: alunoCriado.disciplinaId,
          ...alunoCriado.trabalho,
        });

      expect(resposta.status).to.equal(201);
      expect(resposta.body).to.include({
        alunoId: alunoCriado.id,
        disciplinaId: alunoCriado.disciplinaId,
        titulo: alunoCriado.trabalho.titulo,
        status: 'entregue',
      });

      alunoCriado.trabalhoId = resposta.body.id;
    });
  });

  after(async () => {
    await Promise.all(
      alunosCriados
        .filter(({ trabalhoId }) => trabalhoId)
        .map(({ trabalhoId }) =>
          request(app)
            .delete(`/api/admin/trabalhos/${trabalhoId}`)
            .set('Authorization', `Bearer ${tokenAdmin}`)
        )
    );
    await Matricula.deleteMany({ alunoId: { $in: alunosCriados.map(({ id }) => id) } });
    await Promise.all(
      alunosCriados
        .filter(({ id }) => id)
        .map(({ id }) =>
          request(app)
            .delete(`/api/admin/alunos/${id}`)
            .set('Authorization', `Bearer ${tokenAdmin}`)
        )
    );
    await mongoose.connection.close();
  });
});
