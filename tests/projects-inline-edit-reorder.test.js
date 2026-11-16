import './setup.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import {
  start,
  refresh,
  getState,
  createProject,
  updateProject,
  softDeleteProject,
  reorderProjects,
} from '../assets/js/data.js';
import { getOne } from '../assets/js/db.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

const projectsRoute = { id: 'projects', path: '/projects', title: 'Projects' };
const demoState = () => ({ ...buildDemoData().stores });

let accountId;

beforeEach(() => {
  accountId = tempAccountId('projects');
});

afterEach(async () => {
  await deleteAccountDb(accountId);
});

test('project rows expose inline edit, drag reorder and archived-only delete', () => {
  const active = renderView(projectsRoute, new URLSearchParams(''), demoState());
  assert.match(active, /data-action="project-edit" data-id="p1"/);
  assert.match(active, /data-project-row data-project-id="p1"/);
  assert.match(active, /draggable="true"/);
  assert.match(active, /class="drag-handle"/);
  assert.match(active, /href="#\/project\/RSL\?tab=work&scope=open"/);
  assert.doesNotMatch(active, /data-action="project-delete"/);

  const archived = renderView(projectsRoute, new URLSearchParams('archived=1'), demoState());
  assert.match(archived, /data-action="project-edit" data-id="p5"/);
  assert.match(archived, /data-action="project-archive" data-id="p5">Restore</);
  assert.match(archived, /data-action="project-delete" data-id="p5">Delete</);
  assert.doesNotMatch(archived, /draggable="true"/);
});

test('the edit query renders inline fields for every editable project value', () => {
  const html = renderView(projectsRoute, new URLSearchParams('edit=p1'), demoState());
  assert.match(html, /data-form="project-edit"/);
  assert.match(html, /name="id" value="p1"/);
  for (const field of ['key', 'name', 'description', 'owner', 'status', 'start', 'due', 'keywords']) {
    assert.match(html, new RegExp(`name="${field}"`), `missing ${field} field`);
  }
  assert.match(html, /name="name" type="text" value="Hello Amara"/);
  assert.match(html, /name="keywords" type="text" value="General stuff, Personal Memo"/);
  assert.match(html, /<button class="btn btn-primary btn-sm" type="submit">Save<\/button>/);
  assert.match(html, /<a class="btn btn-ghost btn-sm" href="#\/projects">Cancel<\/a>/);
});

test('reorderProjects persists sort values and survives a refresh', async () => {
  await start({ id: accountId, name: 'Reorder test', test: false });
  const first = await createProject({ key: 'AAA', name: 'First' });
  const second = await createProject({ key: 'BBB', name: 'Second' });

  await reorderProjects([second.id, first.id]);
  assert.deepEqual(getState().projects.map((project) => project.id), [second.id, first.id]);
  assert.equal(getState().projects[0].sort, 1);
  assert.equal(getState().projects[1].sort, 2);

  await refresh();
  assert.deepEqual(getState().projects.map((project) => project.id), [second.id, first.id]);
  assert.equal((await getOne('projects', second.id)).sort, 1);
  assert.equal((await getOne('projects', first.id)).sort, 2);
});

test('softDeleteProject hides an archived project but keeps its tombstone', async () => {
  await start({ id: accountId, name: 'Delete test', test: false });
  const project = await createProject({ key: 'OLD', name: 'Old project' });
  await updateProject(project.id, { archived: 1, status: 'Archived' });
  assert.ok(getState().projects.some((row) => row.id === project.id));

  await softDeleteProject(project.id);
  assert.ok(!getState().projects.some((row) => row.id === project.id), 'deleted project is hidden from state');
  const stored = await getOne('projects', project.id);
  assert.ok(stored.deletedAt, 'project keeps a deletedAt tombstone');
  assert.equal(stored.name, 'Old project');
  assert.equal(stored.archived, 1);
});
