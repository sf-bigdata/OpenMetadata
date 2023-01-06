/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
    descriptionBox,
    interceptURL,
    toastNotification,
    verifyResponseStatusCode,
    visitEntityDetailsPage
} from '../../common/common';
import {
    DELETE_TERM,
    NEW_GLOSSARY,
    NEW_GLOSSARY_TERMS,
    SEARCH_ENTITY_TABLE
} from '../../constants/constants';

const createGlossaryTerm = (term) => {
  cy.get('[data-testid="breadcrumb-link"]')
    .should('exist')
    .and('be.visible')
    .contains(NEW_GLOSSARY.name)
    .should('exist');
  cy.get('[data-testid="add-new-tag-button"]').should('be.visible').click();

  cy.contains('Add Glossary Term').should('be.visible');
  cy.get('[data-testid="name"]')
    .scrollIntoView()
    .should('be.visible')
    .type(term.name);
  cy.get(descriptionBox)
    .scrollIntoView()
    .should('be.visible')
    .type(term.description);
  cy.get('[data-testid="synonyms"]')
    .scrollIntoView()
    .should('be.visible')
    .type(term.synonyms);

  cy.get('[data-testid="references"] > .tw-flex > .button-comp')
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.get('#name-0').scrollIntoView().should('be.visible').type('test');
  cy.get('#url-0')
    .scrollIntoView()
    .should('be.visible')
    .type('https://test.com');

  interceptURL('POST', '/api/v1/glossaryTerms', 'createGlossaryTerms');
  cy.get('[data-testid="save-glossary-term"]')
    .scrollIntoView()
    .should('be.visible')
    .click();
  verifyResponseStatusCode('@createGlossaryTerms', 201);

  cy.get('[data-testid="glossary-left-panel"]')
    .contains(term.name)
    .should('be.visible');
};

const deleteGlossary = ({ name }) => {
  verifyResponseStatusCode('@getGlossaryTerms', 200);
  cy.get('[data-testid="glossary-left-panel"]')
    .contains(name)
    .should('be.visible')
    .click();
  cy.wait(500);
  cy.get('[data-testid="inactive-link"]').contains(name).should('be.visible');

  cy.get('[data-testid="manage-button"]').should('be.visible').click();
  cy.get('[data-testid="delete-button"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.get('[data-testid="delete-confirmation-modal"]')
    .should('exist')
    .then(() => {
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[data-testid="modal-header"]').should('be.visible');
    });
  cy.get('[data-testid="modal-header"]')
    .should('be.visible')
    .should('contain', `Delete ${name}`);
  cy.get('[data-testid="confirmation-text-input"]')
    .should('be.visible')
    .type(DELETE_TERM);

  cy.get('[data-testid="confirm-button"]')
    .should('be.visible')
    .should('not.disabled')
    .click();

  toastNotification('Glossary term deleted successfully!');
  cy.get('[data-testid="delete-confirmation-modal"]').should('not.exist');
  cy.get('[data-testid="glossary-left-panel"]')
    .should('be.visible')
    .should('not.contain', name);
};

const goToAssetsTab = (term) => {
  cy.get('[data-testid="glossary-left-panel"]')
    .should('be.visible')
    .contains(term)
    .click();
  cy.wait(500);
  cy.get('[data-testid="inactive-link"]').contains(term).should('be.visible');
  cy.get('[data-testid="Assets"]').should('be.visible').click();
  cy.get('[data-testid="Assets"]').should('have.class', 'active');
};

describe('Glossary page should work properly', () => {
  beforeEach(() => {
    cy.login();

    interceptURL('GET', '/api/v1/glossaryTerms*', 'getGlossaryTerms');
    cy.get('[data-testid="governance"]')
      .should('exist')
      .and('be.visible')
      .click({ animationDistanceThreshold: 20 });

    //Clicking on Glossary
    cy.get('.ant-dropdown-menu')
      .should('exist')
      .and('be.visible')
      .then(($el) => {
        cy.wrap($el)
          .find('[data-testid="appbar-item-glossary"]')
          .should('exist')
          .and('be.visible')
          .click();
      });

    // Todo: need to remove below uncaught exception once tree-view error resolves
    cy.on('uncaught:exception', () => {
      // return false to prevent the error from
      // failing this test
      return false;
    });
  });

  it('Create new glossary flow should work properly', () => {
    interceptURL('POST', '/api/v1/glossaries', 'createGlossary');

    // check for no data placeholder
    cy.get('[data-testid="add-new-glossary"]')
      .should('be.visible')
      .as('addNewGlossary');

    // Redirecting to add glossary page
    cy.get('@addNewGlossary').click();
    cy.get('[data-testid="form-heading"]')
      .contains('Add Glossary')
      .should('be.visible');

    cy.get('[data-testid="name"]')
      .scrollIntoView()
      .should('be.visible')
      .type(NEW_GLOSSARY.name);

    cy.get(descriptionBox)
      .scrollIntoView()
      .should('be.visible')
      .type(NEW_GLOSSARY.description);

    cy.get('[data-testid="add-reviewers"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirmation-modal"]')
      .should('exist')
      .within(() => {
        cy.get('[role="dialog"]').should('be.visible');
      });

    //Change this once issue related to suggestion API is fixed.
    cy.get('[data-testid="user-card-container"]')
      .first()
      .should('be.visible')
      .as('reviewer');

    cy.get('@reviewer')
      .find('[data-testid="checkboxAddUser"]')
      .should('be.visible')
      .check();

    cy.get('[data-testid="save-button"]')
      .should('exist')
      .and('be.visible')
      .click();
    cy.get('[data-testid="delete-confirmation-modal"]').should('not.exist');
    cy.get('[data-testid="reviewers-container"]')
      .children()
      .should('have.length', 1);

    cy.get('[data-testid="save-glossary"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.wait('@createGlossary').then(() => {
      cy.url().should('include', '/glossary/');
      cy.get('[data-testid="breadcrumb-link"]')
        .should('exist')
        .and('be.visible')
        .within(() => {
          cy.contains(NEW_GLOSSARY.name);
        });
    });
  });

  it('Verify added glossary details', () => {
    cy.get('[data-testid="glossary-left-panel"]')
      .contains(NEW_GLOSSARY.name)
      .should('be.visible');
    cy.get('[data-testid="header"]')
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY.name);
      });
    cy.get('[data-testid="viewer-container"]')
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY.description);
      });
    cy.get('[data-testid="reviewer-card-container"]').should('have.length', 1);
    //Uncomment once the suggestion API issue gets resolved
    cy.get('[data-testid="reviewer-card-container"]')
      .invoke('text')
      .then((text) => {
        expect(text).to.contain(NEW_GLOSSARY.reviewer);
      });
  });

  it('Create glossary term should work properly', () => {
    const terms = Object.values(NEW_GLOSSARY_TERMS);

    terms.forEach(createGlossaryTerm);
  });

  it('Updating data of glossary should work properly', () => {
    const newDescription = 'Updated description';
    // updating tags
    cy.get('[data-testid="tag-container"]')
      .should('exist')
      .and('be.visible')
      .within(() => {
        cy.get('[data-testid="add-tag"]')
          .should('exist')
          .and('be.visible')
          .click();
      });

    cy.get('[data-testid="tag-selector"]')
      .scrollIntoView()
      .should('be.visible')
      .type('personal');
    cy.get(`[title="PersonalData.Personal"]`).should('be.visible').click();

    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    cy.get('[data-testid="glossary-details"]')
      .scrollIntoView()
      .contains('PersonalData.Personal')
      .should('be.visible');

    // updating description
    cy.get('[data-testid="edit-description"]').should('be.visible').click();
    cy.get('.ant-modal-wrap').should('be.visible');
    cy.get(descriptionBox).should('be.visible').as('description');

    cy.get('@description').clear();
    cy.get('@description').type(newDescription);

    interceptURL('PATCH', '/api/v1/glossaries/*', 'saveGlossary');
    cy.get('[data-testid="save"]').click();

    cy.get('.ant-modal-wrap').should('not.exist');

    verifyResponseStatusCode('@saveGlossary', 200);

    cy.get('[data-testid="viewer-container"]')
      .contains(newDescription)
      .should('be.visible');
  });

  it('Update glossary term synonyms', () => {
    const uSynonyms = ['pick up', 'take', 'obtain'];
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms/name/*.${NEW_GLOSSARY_TERMS.term_1.name}?fields=*`,
      'getGlossaryTerm'
    );
    interceptURL(
      'GET',
      '/api/v1/permissions/glossaryTerm/*',
      'waitForTermPermission'
    );
    cy.get('[data-testid="glossary-left-panel"]')
      .should('be.visible')
      .contains(NEW_GLOSSARY_TERMS.term_1.name)
      .click();
    verifyResponseStatusCode('@getGlossaryTerm', 200);
    verifyResponseStatusCode('@waitForTermPermission', 200);
    // updating synonyms
    cy.get('[data-testid="section-synonyms"]')
      .scrollIntoView()
      .should('be.visible');

    cy.wait(200);
    cy.get('[data-testid="section-synonyms"]').find('[data-testid="edit-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('.ant-select-selector').should('be.visible');
    cy.get('.ant-select-clear > .anticon > svg')
      .should('exist')
      .click({ force: true });

    cy.get('.ant-select-selection-overflow')
      .should('exist')
      .type(uSynonyms.join('{enter}'));

    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveSynonyms');
    cy.get('[data-testid="save-btn"]').should('be.visible').click();
    verifyResponseStatusCode('@saveSynonyms', 200);

    cy.get('[data-testid="synonyms-container"]')
      .as('synonyms-container')
      .should('be.visible');

    uSynonyms.forEach((synonym) => {
      cy.get('@synonyms-container').contains(synonym).should('be.visible');
    });
  });

  it('Update glossary term reference and related terms', () => {
    const newRef = { name: 'take', url: 'https://take.com' };
    const term2 = NEW_GLOSSARY_TERMS.term_2.name;
    //Navigate to glossary term
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms/name/*.${NEW_GLOSSARY_TERMS.term_1.name}?fields=*`,
      'getGlossaryTerm'
    );
    interceptURL(
      'GET',
      '/api/v1/permissions/glossaryTerm/*',
      'waitForTermPermission'
    );
    cy.get('[data-testid="glossary-left-panel"]')
      .should('be.visible')
      .contains(NEW_GLOSSARY_TERMS.term_1.name)
      .click();
    verifyResponseStatusCode('@getGlossaryTerm', 200);
    verifyResponseStatusCode('@waitForTermPermission', 200);
    cy.get('[data-testid="section-references"]').should('be.visible')
    cy.wait(200);
    // updating References
    cy.get('[data-testid="section-references"]').find('[data-testid="edit-button"]')
      .should('exist')
      .click();
    cy.get('[data-testid="add-button"]').should('be.visible').click();
    cy.get('#references_1_name').should('be.visible').type(newRef.name);
    cy.get('#references_1_endpoint').should('be.visible').type(newRef.url);
    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveGlossaryTermData');
    cy.get('[data-testid="save-btn"]').should('be.visible').click();
    verifyResponseStatusCode('@saveGlossaryTermData', 200);
    cy.get('[data-testid="references-container"]')
      .contains(newRef.name)
      .should('be.visible')
      .invoke('attr', 'href')
      .should('eq', newRef.url);

    // add relented term
    cy.get('[data-testid="section-related-terms"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-testid="section-related-terms"] [data-testid="edit-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&from=0&size=10&index=glossary_search_index',
      'getGlossaryTerm'
    );
    cy.get('.ant-select-selection-overflow').should('be.visible').click();
    verifyResponseStatusCode('@getGlossaryTerm', 200);
    cy.get('.ant-select-item-option-content')
      .contains(term2)
      .should('be.visible')
      .click();

    cy.get('[data-testid="save-btn"]').should('be.visible').click();
    verifyResponseStatusCode('@saveGlossaryTermData', 200);

    cy.get('[data-testid="related-term-container"]')
      .contains(term2)
      .should('be.visible');
  });

  it('Updating description and tags of glossary term should work properly', () => {
    interceptURL('GET', '/api/v1/permissions/*/*', 'permissionApi');
    interceptURL('GET', '/api/v1/search/query?*', 'glossaryAPI');
    const term = NEW_GLOSSARY_TERMS.term_1.name;
    const newDescription = 'Updated description';
    cy.get('[data-testid="glossary-left-panel"]')
      .should('be.visible')
      .contains(term)
      .click();
    verifyResponseStatusCode('@permissionApi', 200);
    verifyResponseStatusCode('@glossaryAPI', 200);

    // updating tags
    cy.get('[data-testid="tag-container"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('[data-testid="tag-selector"]')
      .scrollIntoView()
      .should('be.visible')
      .type('personal');
    cy.get(`[title="PersonalData.Personal"]`).should('be.visible').click();

    interceptURL('PATCH', '/api/v1/glossaryTerms/*', 'saveData');
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@saveData', 200);
    cy.get('[data-testid="glossary-term"]')
      .scrollIntoView()
      .contains('PersonalData.Personal')
      .should('be.visible');

    // updating description
    cy.get('[data-testid="edit-description"]').should('be.visible').click();
    cy.get('.ant-modal-wrap').should('be.visible');
    cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
      .should('be.visible')
      .as('description');
    cy.get('@description').clear();
    cy.get('@description').type(newDescription);
    cy.get('[data-testid="save"]').click();
    verifyResponseStatusCode('@saveData', 200);
    cy.get('.ant-modal-wrap').should('not.exist');

    cy.get('[data-testid="viewer-container"]')
      .contains(newDescription)
      .should('be.visible');

    cy.get('[data-testid="inactive-link"]').contains(term).should('be.visible');
  });

  it('Assets Tab should work properly', () => {
    const glossary = NEW_GLOSSARY.name;
    const term = NEW_GLOSSARY_TERMS.term_1.name;
    const entity = SEARCH_ENTITY_TABLE.table_3;
    goToAssetsTab(term);
    cy.contains('No assets available.').should('be.visible');
    cy.get('[data-testid="no-data-image"]').should('be.visible');
    visitEntityDetailsPage(entity.term, entity.serviceName, entity.entity);

    //Add tag to breadcrumb
    cy.get('[data-testid="tag-container"] [data-testid="tags"]')
      .eq(0)
      .should('be.visible')
      .click();
    cy.get('[data-testid="tag-selector"]').should('be.visible').click().type(`${glossary}.${term}`);
    cy.get(`[title*="${term}"]`).should('be.visible').click();
    cy.get(
      '[data-testid="tags-wrapper"] [data-testid="tag-container"]'
    ).contains(term);

    interceptURL('GET', '/api/v1/feed/count*', 'saveTag');
    interceptURL('GET', '/api/v1/tags', 'tags');

    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();

    verifyResponseStatusCode('@saveTag', 200);
    cy.get('[data-testid="entity-tags"]')
      .scrollIntoView()
      .should('be.visible')
      .contains(term);

    //Add tag to schema table
    cy.get(
      '[data-row-key="comments"] [data-testid="tags-wrapper"] [data-testid="tag-container"]'
    )
      .should('be.visible')
      .first()
      .click();

    cy.get('[data-testid="tag-selector"]').should('be.visible').click().type(`${glossary}.${term}`);
    cy.get(`[title*="${term}"]`).should('be.visible').click();

    cy.get(
      '[data-row-key="comments"] [data-testid="tags-wrapper"] [data-testid="tag-container"]'
    ).contains(term);
    cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
    verifyResponseStatusCode('@saveTag', 200);
    cy.get(`[data-testid="tag-${glossary}.${term}"]`)
      .scrollIntoView()
      .should('be.visible')
      .contains(term);

    cy.get('[data-testid="governance"]')
      .should('exist')
      .and('be.visible')
      .click();
    cy.get('[data-testid="appbar-item-glossary"]')
      .should('exist')
      .should('be.visible')
      .click();

    goToAssetsTab(term);
    cy.get(`[data-testid="${entity.serviceName}-${entity.term}"]`)
      .contains(entity.term)
      .should('be.visible');
  });

  it('Remove Glossary term from entity should work properly', () => {
    const term = NEW_GLOSSARY_TERMS.term_1.name;
    const entity = SEARCH_ENTITY_TABLE.table_3;

    interceptURL('GET', '/api/v1/search/query*', 'assetTab');
    // go assets tab
    goToAssetsTab(term);
    verifyResponseStatusCode('@assetTab', 200);

    interceptURL('GET', '/api/v1/feed*', 'entityDetails');
    cy.get(`[data-testid="${entity.serviceName}-${entity.term}"]`)
      .contains(entity.term)
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@entityDetails', 200);
    // redirect to entity detail page
    cy.get('[data-testid="entity-tags"]')
      .find('[data-testid="edit-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    //Remove all added tags from breadcrumb
    cy.get('.ant-select-selection-item-remove')
      .eq(0)
      .should('be.visible')
      .click();
    cy.wait(200);
    cy.get('.ant-select-selection-item-remove')
      .eq(0)
      .should('be.visible')
      .click();

    interceptURL('PATCH', '/api/v1/tables/*', 'removeTags');
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@removeTags', 200);

    cy.get('[data-testid="entity-tags"]')
      .should('not.contain', term)
      .and('not.contain', 'Personal');
    //Remove the added column tag from entity
    
    cy.get('[data-testid="remove"]').eq(0).should('be.visible').click();
    cy.wait(200);
    interceptURL('PATCH', '/api/v1/tables/*', 'removeSchemaTags');
    cy.get('[data-testid="remove"]').eq(0).should('be.visible').click();
    verifyResponseStatusCode('@removeSchemaTags', 200);

    cy.get('[data-testid="tags"]')
      .should('not.contain', term)
      .and('not.contain', 'Personal');

    cy.get('[data-testid="governance"]')
      .should('exist')
      .should('be.visible')
      .click();
    cy.get('[data-testid="appbar-item-glossary"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.wait(500);
    goToAssetsTab(term);
    cy.contains('No assets available.').should('be.visible');
    cy.get('[data-testid="no-data-image"]').should('be.visible');
  });

  it('Delete glossary term should work properly', () => {
    const terms = Object.values(NEW_GLOSSARY_TERMS);

    terms.forEach(deleteGlossary);
  });

  it('Delete glossary should work properly', () => {
    verifyResponseStatusCode('@getGlossaryTerms', 200);
    cy.get('[data-testid="header"]')
      .should('be.visible')
      .contains(NEW_GLOSSARY.name)
      .should('exist');
    cy.get('[data-testid="manage-button"]').should('be.visible').click();
    cy.get('[data-testid="delete-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[data-testid="delete-confirmation-modal"]')
      .should('exist')
      .then(() => {
        cy.get('[role="dialog"]').should('be.visible');
        cy.get('[data-testid="modal-header"]').should('be.visible');
      });
    cy.get('[data-testid="modal-header"]')
      .should('be.visible')
      .should('contain', `Delete ${NEW_GLOSSARY.name}`);
    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type(DELETE_TERM);
    interceptURL('DELETE', '/api/v1/glossaries/*', 'getGlossary');
    cy.get('[data-testid="confirm-button"]')
      .should('be.visible')
      .should('not.disabled')
      .click();
    verifyResponseStatusCode('@getGlossary', 200);

    toastNotification('Glossary deleted successfully!');
    cy.contains('Add New Glossary').should('be.visible');
  });
});
