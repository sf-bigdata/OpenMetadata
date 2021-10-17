/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceDAO;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.charts.ChartResource;
import org.openmetadata.catalog.resources.charts.ChartResource.ChartList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.common.utils.CipherText;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public abstract class ChartRepository {
  private static final Logger LOG = LoggerFactory.getLogger(ChartRepository.class);
  private static final Fields CHART_UPDATE_FIELDS = new Fields(ChartResource.FIELD_LIST, "owner");
  private static final Fields CHART_PATCH_FIELDS = new Fields(ChartResource.FIELD_LIST, "owner,service,tags");

  public static String getFQN(EntityReference service, Chart chart) {
    return (service.getName() + "." + chart.getName());
  }

  @CreateSqlObject
  abstract ChartDAO chartDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract DashboardServiceDAO dashboardServiceDAO();

  @CreateSqlObject
  abstract TagRepository.TagDAO tagDAO();


  @Transaction
  public ChartList listAfter(Fields fields, String serviceName, int limitParam, String after) throws IOException,
          GeneralSecurityException {
    // forward scrolling, if after == null then first page is being asked being asked
    List<String> jsons = chartDAO().listAfter(serviceName, limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Chart> charts = new ArrayList<>();
    for (String json : jsons) {
      charts.add(setFields(JsonUtils.readValue(json, Chart.class), fields));
    }
    int total = chartDAO().listCount(serviceName);

    String beforeCursor, afterCursor = null;
    beforeCursor = after == null ? null : charts.get(0).getFullyQualifiedName();
    if (charts.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
      charts.remove(limitParam);
      afterCursor = charts.get(limitParam - 1).getFullyQualifiedName();
    }
    return new ChartList(charts, beforeCursor, afterCursor, total);
  }

  @Transaction
  public ChartList listBefore(Fields fields, String serviceName, int limitParam, String before) throws IOException,
          GeneralSecurityException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons = chartDAO().listBefore(serviceName, limitParam + 1, CipherText.instance().decrypt(before));
    List<Chart> charts = new ArrayList<>();
    for (String json : jsons) {
      charts.add(setFields(JsonUtils.readValue(json, Chart.class), fields));
    }
    int total = chartDAO().listCount(serviceName);

    String beforeCursor = null, afterCursor;
    if (charts.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      charts.remove(0);
      beforeCursor = charts.get(0).getFullyQualifiedName();
    }
    afterCursor = charts.get(charts.size() - 1).getFullyQualifiedName();
    return new ChartList(charts, beforeCursor, afterCursor, total);
  }

  @Transaction
  public Chart get(String id, Fields fields) throws IOException {
    return setFields(validateChart(id), fields);
  }

  @Transaction
  public Chart getByName(String fqn, Fields fields) throws IOException {
    Chart chart = EntityUtil.validate(fqn, chartDAO().findByFQN(fqn), Chart.class);
    return setFields(chart, fields);
  }

  @Transaction
  public Chart create(Chart chart, EntityReference service, EntityReference owner) throws IOException {
    return createInternal(chart, service, owner);
  }

  @Transaction
  public void delete(String id) {
    if (relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.CHART) > 0) {
      throw new IllegalArgumentException("Chart is not empty");
    }
    if (chartDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.CHART, id));
    }
    relationshipDAO().deleteAll(id);
  }

  @Transaction
  public PutResponse<Chart> createOrUpdate(Chart updated, EntityReference service, EntityReference newOwner)
          throws IOException {
    getService(service); // Validate service
    String fqn = getFQN(service, updated);
    Chart stored = JsonUtils.readValue(chartDAO().findByFQN(fqn), Chart.class);
    if (stored == null) {  // Chart does not exist. Create a new one
      return new PutResponse<>(Status.CREATED, createInternal(updated, service, newOwner));
    }
    setFields(stored, CHART_UPDATE_FIELDS);
    updated.setId(stored.getId());
    validateRelationships(updated, service, newOwner);

    ChartUpdater chartUpdater = new ChartUpdater(stored, updated, false);
    chartUpdater.updateAll();
    chartUpdater.store();
    return new PutResponse<>(Status.OK, updated);
  }

  @Transaction
  public Chart patch(String id, String user, JsonPatch patch) throws IOException {
    Chart original = setFields(validateChart(id), CHART_PATCH_FIELDS);
    Chart updated = JsonUtils.applyPatch(original, patch, Chart.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);
    return updated;
  }

  public Chart createInternal(Chart chart, EntityReference service, EntityReference owner) throws IOException {
    validateRelationships(chart, service, owner);
    storeChart(chart, false);
    addRelationships(chart);
    return chart;
  }

  private void validateRelationships(Chart chart, EntityReference service, EntityReference owner) throws IOException {
    chart.setFullyQualifiedName(getFQN(service, chart));
    EntityUtil.populateOwner(userDAO(), teamDAO(), owner); // Validate owner
    getService(service);
    chart.setTags(EntityUtil.addDerivedTags(tagDAO(), chart.getTags()));
  }

  private void addRelationships(Chart chart) throws IOException {
    setService(chart, chart.getService());
    setOwner(chart, chart.getOwner());
    applyTags(chart);
  }

  private void storeChart(Chart chart, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = chart.getOwner();
    List<TagLabel> tags = chart.getTags();
    EntityReference service = chart.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    chart.withOwner(null).withService(null).withHref(null).withTags(null);

    if (update) {
      chartDAO().update(chart.getId().toString(), JsonUtils.pojoToJson(chart));
    } else {
      chartDAO().insert(JsonUtils.pojoToJson(chart));
    }

    // Restore the relationships
    chart.withOwner(owner).withService(service).withTags(tags);
  }


  private void applyTags(Chart chart) throws IOException {
    // Add chart level tags by adding tag to chart relationship
    EntityUtil.applyTags(tagDAO(), chart.getTags(), chart.getFullyQualifiedName());
    chart.setTags(getTags(chart.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private void patch(Chart original, Chart updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withService(original.getService()).withId(original.getId());
    validateRelationships(updated, updated.getService(), updated.getOwner());
    ChartUpdater chartUpdater = new ChartUpdater(original, updated, true);
    chartUpdater.updateAll();
    chartUpdater.store();
  }

  public EntityReference getOwner(Chart chart) throws IOException {
    return chart != null ? EntityUtil.populateOwner(chart.getId(), relationshipDAO(), userDAO(), teamDAO()) : null;
  }

  private void setOwner(Chart chart, EntityReference owner) {
    EntityUtil.setOwner(relationshipDAO(), chart.getId(), Entity.CHART, owner);
    // TODO not required
    chart.setOwner(owner);
  }

  private Chart validateChart(String id) throws IOException {
    return EntityUtil.validate(id, chartDAO().findById(id), Chart.class);
  }

  private Chart setFields(Chart chart, Fields fields) throws IOException {
    chart.setOwner(fields.contains("owner") ? getOwner(chart) : null);
    chart.setService(fields.contains("service") ? getService(chart) : null);
    chart.setFollowers(fields.contains("followers") ? getFollowers(chart) : null);
    chart.setTags(fields.contains("tags") ? getTags(chart.getFullyQualifiedName()) : null);
    return chart;
  }

  private List<EntityReference> getFollowers(Chart chart) throws IOException {
    return chart == null ? null : EntityUtil.getFollowers(chart.getId(), relationshipDAO(), userDAO());
  }

  private List<TagLabel> getTags(String fqn) {
    return tagDAO().getTags(fqn);
  }

  private EntityReference getService(Chart chart) throws IOException {
    return chart == null ? null : getService(Objects.requireNonNull(EntityUtil.getService(relationshipDAO(),
            chart.getId(), Entity.DASHBOARD_SERVICE)));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      DashboardService serviceInstance = EntityUtil.validate(id, dashboardServiceDAO().findById(id),
              DashboardService.class);
      service.setDescription(serviceInstance.getDescription());
      service.setName(serviceInstance.getName());
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the chart", service.getType()));
    }
    return service;
  }

  public void setService(Chart chart, EntityReference service) throws IOException {
    if (service != null && chart != null) {
      // TODO remove this
      getService(service); // Populate service details
      relationshipDAO().insert(service.getId().toString(), chart.getId().toString(), service.getType(),
              Entity.CHART, Relationship.CONTAINS.ordinal());
      chart.setService(service);
    }
  }

  @Transaction
  public Status addFollower(String chartId, String userId) throws IOException {
    EntityUtil.validate(chartId, chartDAO().findById(chartId), Chart.class);
    return EntityUtil.addFollower(relationshipDAO(), userDAO(), chartId, Entity.CHART, userId, Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(String chartId, String userId) {
    EntityUtil.validateUser(userDAO(), userId);
    EntityUtil.removeFollower(relationshipDAO(), chartId, userId);
  }

  public interface ChartDAO {
    @SqlUpdate("INSERT INTO chart_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE chart_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM chart_entity WHERE fullyQualifiedName = :name")
    String findByFQN(@Bind("name") String name);

    @SqlQuery("SELECT json FROM chart_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT count(*) FROM chart_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL)")
    int listCount(@Bind("fqnPrefix") String fqnPrefix);

    @SqlQuery(
            "SELECT json FROM (" +
                    "SELECT fullyQualifiedName, json FROM chart_entity WHERE " +
                    "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by
                    // service name
                    "fullyQualifiedName < :before " + // Pagination by chart fullyQualifiedName
                    "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by chart fullyQualifiedName
                    "LIMIT :limit" +
                    ") last_rows_subquery ORDER BY fullyQualifiedName")
    List<String> listBefore(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                            @Bind("before") String before);

    @SqlQuery("SELECT json FROM chart_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
            "fullyQualifiedName > :after " +
            "ORDER BY fullyQualifiedName " +
            "LIMIT :limit")
    List<String> listAfter(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                           @Bind("after") String after);

    @SqlQuery("SELECT EXISTS (SELECT * FROM chart_entity WHERE id = :id)")
    boolean exists(@Bind("id") String id);

    @SqlUpdate("DELETE FROM chart_entity WHERE id = :id")
    int delete(@Bind("id") String id);
  }

  static class ChartEntityInterface implements EntityInterface {
    private final Chart chart;

    ChartEntityInterface(Chart Chart) {
      this.chart = Chart;
    }

    @Override
    public UUID getId() {
      return chart.getId();
    }

    @Override
    public String getDescription() {
      return chart.getDescription();
    }

    @Override
    public String getDisplayName() {
      return chart.getDisplayName();
    }

    @Override
    public EntityReference getOwner() {
      return chart.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return chart.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return chart.getTags();
    }

    @Override
    public void setDescription(String description) {
      chart.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      chart.setDisplayName(displayName);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      chart.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class ChartUpdater extends EntityUpdater {
    final Chart orig;
    final Chart updated;

    public ChartUpdater(Chart orig, Chart updated, boolean patchOperation) {
      super(new ChartEntityInterface(orig), new ChartEntityInterface(updated), patchOperation, relationshipDAO(),
              tagDAO());
      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      super.updateAll();
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      storeChart(updated, true);
    }
  }
}
