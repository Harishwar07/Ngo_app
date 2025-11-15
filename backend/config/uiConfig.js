// config/uiConfig.js

const uiConfig = {
  students: {
    entityName: "Students",
    columns: [
      { key: "student_frf_name", label: "Student FRF Name", sortable: true, filterType: "text" },
      { key: "class", label: "Class", sortable: true, filterType: "select" },
      { key: "section", label: "Section", sortable: true, filterType: "select" },
      { key: "avg_overall_score", label: "AVG Overall Score", sortable: true, filterType: "numberRange" }
    ],
    defaultSort: { key: "student_frf_name", order: "asc" }
  },

  volunteers: {
    entityName: "Volunteers",
    columns: [
      { key: "volunteer_frf_name", label: "Volunteer FRF Name", sortable: true, filterType: "text" },
      { key: "email", label: "Email", sortable: true, filterType: "text" },
      { key: "volunteer_frf_owner_user_id", label: "Volunteer FRF Owner", sortable: true, filterType: "user" },
      { key: "modified_date", label: "Modified Time", sortable: true, filterType: "date" }
    ],
    defaultSort: { key: "volunteer_frf_name", order: "asc" }
  },

  donors: {
    entityName: "Donors",
    columns: [
      { key: "donor_frf_name", label: "Donor FRF Name", sortable: true, filterType: "text" },
      { key: "email", label: "Email", sortable: true, filterType: "text" },
      { key: "donor_frf_owner_user_id", label: "Donor FRF Owner", sortable: true, filterType: "user" },
      { key: "modified_date", label: "Modified Time", sortable: true, filterType: "date" }
    ],
    defaultSort: { key: "donor_frf_name", order: "asc" }
  },

  board: {
    entityName: "Board of Trustees",
    columns: [
      { key: "board_frf_name", label: "Board of Trustees FRF Name", sortable: true, filterType: "text" },
      { key: "email", label: "Email", sortable: true, filterType: "text" },
      { key: "board_frf_owner_user_id", label: "Board FRF Owner", sortable: true, filterType: "user" },
      { key: "modified_date", label: "Modified Time", sortable: true, filterType: "date" }
    ],
    defaultSort: { key: "board_frf_name", order: "asc" }
  },

  projects: {
    entityName: "Projects",
    columns: [
      { key: "project_frf_name", label: "Project FRF Name", sortable: true, filterType: "text" },
      { key: "email", label: "Email", sortable: true, filterType: "text" },
      { key: "project_frf_owner_user_id", label: "Project FRF Owner", sortable: true, filterType: "user" },
      { key: "modified_date", label: "Modified Time", sortable: true, filterType: "date" }
    ],
    defaultSort: { key: "project_frf_name", order: "asc" }
  },

  finance: {
    entityName: "Finance Reports",
    columns: [
      { key: "finance_report_frf_name", label: "Finance Report FRF Name", sortable: true, filterType: "text" },
      { key: "email", label: "Email", sortable: true, filterType: "text" },
      { key: "finance_report_frf_owner_user_id", label: "Finance FRF Owner", sortable: true, filterType: "user" },
      { key: "modified_date", label: "Modified Time", sortable: true, filterType: "date" }
    ],
    defaultSort: { key: "finance_report_frf_name", order: "asc" }
  }
};

module.exports = uiConfig;