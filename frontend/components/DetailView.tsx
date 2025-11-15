import React, { useState, useEffect } from 'react';
import type { FrfEntity, AnyRecord, Student, Donor, Volunteer, Project, FinanceReport, BoardMember } from '../types';
import { fetch_frf_detail } from '../services/mockApi';

interface DetailViewProps {
  entity: FrfEntity;
  id: string;
  on_back: () => void;
}

const DetailCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
    <h3 className="text-lg md:text-xl font-bold text-gray-800 border-b-2 border-indigo-100 pb-3 mb-4">{title}</h3>
    {children}
  </div>
);

const KeyValueGrid: React.FC<{ data: Record<string, any> }> = ({ data }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
    {Object.entries(data).map(([key, value]) => (
      <div key={key}>
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{key.replace(/_/g, ' ')}</p>
        <p className="text-base text-gray-900 break-words">{String(value ?? 'N/A')}</p>
      </div>
    ))}
  </div>
);

const SubformTable: React.FC<{ columns: { key: string, label: string }[], data: any[], summary?: React.ReactNode }> = ({ columns, data, summary }) => (
    <div>
        <div className="overflow-x-auto">
            <table className="w-full text-left table-auto mt-4">
                <thead className="bg-gray-50">
                    <tr>{columns.map(c => <th key={c.key} className="p-2 text-xs md:p-3 md:text-sm font-semibold text-gray-600 uppercase tracking-wider">{c.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {data.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                            {columns.map(c => <td key={c.key} className="p-2 text-sm md:p-3 text-gray-700">{row[c.key]}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {summary && <div className="mt-4 p-3 bg-indigo-50 rounded-lg text-indigo-800 font-semibold text-right text-sm md:text-base">{summary}</div>}
    </div>
);

const OverviewCard: React.FC<{ data: Record<string, any>, owner_label?: string }> = ({ data, owner_label = 'Owner' }) => {
  
  const formatDateTime = (dt?: string) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
      {/* Title */}
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 break-words">
        {data.name}
      </h2>

      {/* Owner + Email */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-3 text-sm text-gray-700">
        <p><span className="font-semibold">{owner_label}:</span> {data.owner || '—'}</p>
        <p><span className="font-semibold">Email:</span> <span className="break-all">{data.email || '—'}</span></p>
      </div>

      {/* Created + Modified metadata */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">

        {/* Created Section */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-gray-500 font-semibold uppercase tracking-wider text-xs">Created By</p>
          <p className="text-gray-900 font-medium">
            {data.created_by_username ? `${data.created_by_username} (${data.created_by_email})` : '—'}
          </p>
          <p className="text-gray-600 text-sm mt-1">
            {formatDateTime(data.created_by_date)}
          </p>
        </div>

        {/* Modified Section */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-gray-500 font-semibold uppercase tracking-wider text-xs">Modified By</p>
          <p className="text-gray-900 font-medium">
            {data.modified_by_username ? `${data.modified_by_username} (${data.modified_by_email})` : '—'}
          </p>
          <p className="text-gray-600 text-sm mt-1">
            {formatDateTime(data.modified_date)}
          </p>
        </div>

      </div>
    </div>
  );
};


export const DetailView: React.FC<DetailViewProps> = ({ entity, id, on_back }) => {
  const [record, set_record] = useState<AnyRecord | null>(null);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => {
    set_loading(true);
    set_error(null);
    fetch_frf_detail(entity.id, id)
      .then(data => {
        set_record(data);
      })
      .catch(err => {
        console.error(err);
        set_error('Failed to load record details. Please try again later.');
      })
      .finally(() => {
        set_loading(false);
      });
  }, [entity.id, id]);

  if (loading) return <div className="text-center p-10">Loading details...</div>;
  if (error) return <div className="text-center p-10 text-red-500">{error}</div>;
  if (!record) return <div className="text-center p-10 text-red-500">Record not found.</div>;

  const render_content = () => {
    switch (entity.id) {
      case 'students': {
        const student = record as Student;
        const avg_score = student.session_logs.length > 0 ? student.session_logs.reduce((acc, p) => acc + p.overall_score, 0) / student.session_logs.length : 0;
        return (
          <>
            <OverviewCard
            data={{
              name: student.student_frf_name,
              owner: student.student_frf_owner,
              email: student.email,
              created_by_username: student.created_by_username,
              created_by_email: student.created_by_email,
              created_by_date: student.created_by_date,
              modified_by_username: student.modified_by_username,
              modified_by_email: student.modified_by_email,
              modified_date: student.modified_date
            }}
            owner_label="Student FRF Owner"
            />

            <DetailCard title="Student FRF Information">
              <KeyValueGrid data={{ student_frf_name: student.student_frf_name, student_frf_owner: student.student_frf_owner, created_date: new Date(student.created_by_date).toLocaleDateString(), modified_date: new Date(student.modified_date).toLocaleDateString(), email: student.email, secondary_email: student.secondary_email, email_opt_out: student.email_opt_out ? 'Yes' : 'No' }} />
            </DetailCard>
            <DetailCard title="Personal Information">
              <KeyValueGrid data={{ date_of_birth: student.date_of_birth, father_name: student.father_name, blood_group: student.blood_group, mother_name: student.mother_name, parents_contact_number: student.parents_contact_number, address: student.address, monthly_income: `$${student.monthly_income}`, permanent_address: student.permanent_address }} />
            </DetailCard>
             <DetailCard title="Education">
              <KeyValueGrid data={{ class: student.class, section: student.section, medium: student.medium, school: student.school }} />
            </DetailCard>
            <DetailCard title="Session Logs">
                <SubformTable 
                    columns={[
                        {key: 'session_date', label: 'Date'}, {key: 'course', label: 'Course'}, {key: 'topic_covered', label: 'Topic Covered'}, {key: 'interest_level', label: 'Interest Level'}, {key: 'challenges_faced', label: 'Challenges Faced'}, {key: 'understanding_level', label: 'Understanding (1-5)'}, {key: 'overall_score', label: 'Score'}, {key: 'remarks', label: 'Remarks'}, {key: 'feedback', label: 'Feedback'}, {key: 'home_work', label: 'Homework'}
                    ]}
                    data={student.session_logs}
                    summary={`AVG Overall Score: ${avg_score.toFixed(2)}`}
                />
            </DetailCard>
          </>
        );
      }
case 'volunteers': {
  const volunteer = record as Volunteer;
  const logs = (volunteer.attendance ?? (volunteer as any).attendance_logs ?? []) as any[];
  // ✅ Transform attendance data properly
  const attendanceData = logs.map(a => ({
    date: new Date(a.attendance_date).toLocaleDateString(),
    attendance: a.attendance_status,
    performance: a.performance ?? 'N/A',
    remarks: a.remarks || '-'
  }));

  // ✅ Compute average performance
  const avgPerformance =
    attendanceData.length > 0
      ? (
          attendanceData.reduce(
            (sum, a) => sum + (Number(a.performance) || 0),
            0
          ) / attendanceData.length
        ).toFixed(2)
      : 'N/A';

  return (
    <>
<OverviewCard
  data={{
    name: volunteer.volunteer_frf_name,
    owner: volunteer.volunteer_frf_owner,
    email: volunteer.email,

    created_by_username: volunteer.created_by_username,
    created_by_email: volunteer.created_by_email,
    created_by_date: volunteer.created_by_date,

    modified_by_username: volunteer.modified_by_username,
    modified_by_email: volunteer.modified_by_email,
    modified_date: volunteer.modified_date
  }}
  owner_label="Volunteer FRF Owner"
/>


      <DetailCard title="Volunteer FRF Information">
        <KeyValueGrid
          data={{
            volunteer_frf_name: volunteer.volunteer_frf_name,
            volunteer_frf_owner: volunteer.volunteer_frf_owner,
            volunteer_id: volunteer.volunteer_id,
            created_date: new Date(volunteer.created_by_date).toLocaleDateString(),
            modified_date: new Date(volunteer.modified_date).toLocaleDateString(),
            email: volunteer.email,
            secondary_email: volunteer.secondary_email,
            email_opt_out: volunteer.email_opt_out ? 'Yes' : 'No'
          }}
        />
      </DetailCard>

      <DetailCard title="Personal Information">
        <KeyValueGrid
          data={{
            gender: volunteer.gender,
            date_of_birth: volunteer.date_of_birth,
            father_name: volunteer.father_name,
            mother_name: volunteer.mother_name,
            contact_number: volunteer.contact_number,
            emergency_contact_number: volunteer.emergency_contact_number,
            address: volunteer.address,
            blood_group: volunteer.blood_group
          }}
        />
      </DetailCard>

      <DetailCard title="Work Information">
        <KeyValueGrid
          data={{
            company_name: volunteer.company_name,
            experience: volunteer.experience,
            skill: volunteer.skill
          }}
        />
      </DetailCard>

      <DetailCard title="Proof Details">
        <KeyValueGrid
          data={{
            id_proof_type: volunteer.id_proof_type,
            id_number: volunteer.id_number,
            joining_date: volunteer.joining_date,
            proof_file: 'Click to view'
          }}
        />
      </DetailCard>

      <DetailCard title="Attendance & Performance">
        <SubformTable
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'attendance', label: 'Attendance' },
            { key: 'performance', label: 'Performance' },
            { key: 'remarks', label: 'Remarks' }
          ]}
          data={attendanceData}
          summary={`Avg Performance: ${avgPerformance}`}
        />
      </DetailCard>
    </>
  );
}
       case 'donors': {
  const donor = record as Donor;

  // ensure donations is an array
  const donationsArr = Array.isArray(donor.donations) ? donor.donations : [];

  // ensure numeric amount and consistent date format
  const mapped = donationsArr.map(d => {
    const amt = Number(d.amount) || 0;
    return {
      ...d,
      amount: `$${amt.toFixed(2)}`,
      donation_date: d.donation_date ? new Date(d.donation_date).toLocaleDateString() : '-',
      // if backend returns 'Yes'/'No' already for '80G_receipt_issued', keep it; else normalize boolean
      '80G_receipt_issued': d['80G_receipt_issued'] === undefined ? (d['80g_receipt_issued'] ? 'Yes' : 'No') : d['80G_receipt_issued']
    }
  });

  const total_donated = donationsArr.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

  return (
    <>
<OverviewCard
  data={{
    name: donor.donor_frf_name,
    owner: donor.donor_frf_owner,
    email: donor.email,

    created_by_username: donor.created_by_username,
    created_by_email: donor.created_by_email,
    created_by_date: donor.created_by_date,

    modified_by_username: donor.modified_by_username,
    modified_by_email: donor.modified_by_email,
    modified_date: donor.modified_date
  }}
  owner_label="Donor FRF Owner"
/>


      <DetailCard title="Donor FRF Information">
        <KeyValueGrid data={{ donor_frf_name: donor.donor_frf_name, donor_frf_owner: donor.donor_frf_owner, created_date: new Date(donor.created_by_date).toLocaleDateString(), modified_date: donor.modified_date ? new Date(donor.modified_date).toLocaleDateString() : '-', email: donor.email, secondary_email: donor.secondary_email, email_opt_out: donor.email_opt_out ? 'Yes' : 'No' }} />
      </DetailCard>
      <DetailCard title="Donors Details">
        <KeyValueGrid data={{ donor_id: donor.donor_id, type: donor.type, contact_person: donor.contact_person, contact_number: donor.contact_number, address: donor.address }} />
      </DetailCard>
      <DetailCard title="Donor Transactions">
        <SubformTable
          columns={[
            { key: 'donation_date', label: 'Date' }, { key: 'transaction_id', label: 'Transaction ID' }, { key: 'purpose', label: 'Purpose' }, { key: 'receipt_number', label: 'Receipt No.' }, { key: '80G_receipt_issued', label: '80G Receipt Issued' }, { key: 'acknowledgment_sent', label: 'Acknowledgement Sent' }, { key: 'donor_feedback', label: 'Feedback' }, { key: 'remarks', label: 'Remarks' }, { key: 'amount', label: 'Amount' }
          ]}
          data={mapped}
          summary={`Total: $${total_donated.toFixed(2)}`}
        />
      </DetailCard>
    </>
  );
}
      case 'projects': {
        const project = record as Project;
        return (
            <>
                <OverviewCard
  data={{
    name: project.project_frf_name,
    owner: project.project_frf_owner,
    email: project.email,

    created_by_username: project.created_by_username,
    created_by_email: project.created_by_email,
    created_by_date: project.created_by_date,

    modified_by_username: project.modified_by_username,
    modified_by_email: project.modified_by_email,
    modified_date: project.modified_date
  }}
  owner_label="Project FRF Owner"
/>

                 <DetailCard title="Project FRF Information">
                    <KeyValueGrid data={{ project_frf_name: project.project_frf_name, project_frf_owner: project.project_frf_owner, created_date: new Date(project.created_by_date).toLocaleDateString(), modified_date: new Date(project.modified_date).toLocaleDateString(), email: project.email, secondary_email: project.secondary_email, email_opt_out: project.email_opt_out ? 'Yes' : 'No' }} />
                </DetailCard>
                <DetailCard title="Project Details">
                    <KeyValueGrid data={{ project_name: project.project_frf_name, project_id: project.project_id, start_date: project.start_date, end_date: project.end_date, duration: project.duration, objective: project.objective, budget: `$${(project.budget ?? 0).toFixed(2)}`,budget_utilized: `$${(project.budget_utilized ?? 0).toFixed(2)}`, impact_summary: project.impact_summary, location: project.location, target_group: project.target_group, responsible_officer: project.responsible_officer }} />
                </DetailCard>
                <DetailCard title="Attendance Log">
                    <SubformTable 
                      columns={[{ key: 'log_date', label: 'Date' }, { key: 'attent_list', label: 'Attended' }, { key: 'absent_list', label: 'Absent' }, { key: 'overall', label: 'Overall' }, { key: 'remarks', label: 'Remarks' }]} 
                      data={project.attendance_logs || []} 
                      summary={`Avg Overall: N/A`}
                    />
                </DetailCard>
            </>
        )
    }
    case 'finance': {
      const report = record as FinanceReport;
      const total_income = report.transactions.reduce((acc, t) => acc + t.income_amount, 0);
      const total_expense = report.transactions.reduce((acc, t) => acc + t.expense_amount, 0);
      const formatCurrency = (val: unknown) => {
      const num = Number(val);
        return !isNaN(num) && num > 0 ? `$${num.toFixed(2)}` : '-';
      };

      return (
          <>
              <OverviewCard
  data={{
    name: report.finance_report_frf_name,
    owner: report.finance_report_frf_owner,
    email: report.email,

    created_by_username: report.created_by_username,
    created_by_email: report.created_by_email,
    created_by_date: report.created_by_date,

    modified_by_username: report.modified_by_username,
    modified_by_email: report.modified_by_email,
    modified_date: report.modified_date
  }}
  owner_label="Finance Report FRF Owner"
/>

              <DetailCard title="Finance FRF Information">
                  <KeyValueGrid data={{ finance_report_frf_name: report.finance_report_frf_name, finance_report_frf_owner: report.finance_report_frf_owner, project_name: report.project_name, created_date: new Date(report.created_by_date).toLocaleDateString(), modified_date: new Date(report.modified_date).toLocaleDateString(), email: report.email, secondary_email: report.secondary_email, email_opt_out: report.email_opt_out ? 'Yes' : 'No' }} />
              </DetailCard>
              <DetailCard title="Transaction Ledger">
                  <SubformTable
                      columns={[
                          { key: 'transaction_date', label: 'Date' }, { key: 'name', label: 'Name' }, { key: 'income_amount', label: 'Income' }, { key: 'expense_amount', label: 'Expense' }, { key: 'bill_transaction_id', label: 'Bill/Txn ID' }, { key: 'gst', label: 'GST' }, { key: 'remarks', label: 'Remarks' }, { key: 'other_details', label: 'Other Details' }
                      ]}
                    data={report.transactions.map(t => ({
                      ...t,
                      income_amount: formatCurrency(t.income_amount),
                      expense_amount: formatCurrency(t.expense_amount),
                    }))}



                    summary={
                        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-6">
                            <p>Total Income: ${Number(total_income || 0).toFixed(2)}</p>
                            <p>Total Expense: ${Number(total_expense || 0).toFixed(2)}</p>
                            <span>Net: <span className="font-bold">${(total_income-total_expense).toFixed(2)}</span></span>
                          </div>
                      }
                  />
              </DetailCard>
          </>
      )
  }
    case 'board': {
        const member = record as BoardMember;
        return (
            <>
                <OverviewCard
  data={{
    name: member.board_frf_name,
    owner: member.board_frf_owner,
    email: member.email,

    // CREATED
    created_by_username: member.created_by_username,
    created_by_email: member.created_by_email,
    created_by_date: member.created_by_date,

    // MODIFIED
    modified_by_username: member.modified_by_username,
    modified_by_email: member.modified_by_email,
    modified_date: member.modified_date
  }}
  owner_label="Board of Trustees FRF Owner"
/>

                <DetailCard title="Board of Trustees FRF Information">
                    <KeyValueGrid data={{ 
                        board_of_trustees_name: member.board_frf_name,
                        board_of_trustees_frf_owner: member.board_frf_owner,
                        created_date: new Date(member.created_by_date).toLocaleDateString(),
                        modified_date: new Date(member.modified_date).toLocaleDateString(),
                        email: member.email,
                        secondary_email: member.secondary_email,
                        email_opt_out: member.email_opt_out ? 'Yes' : 'No',
                     }} />
                </DetailCard>
                <DetailCard title="Personal Information">
                    <KeyValueGrid data={{
                        gender: member.gender,
                        date_of_birth: member.date_of_birth,
                        contact_number: member.contact_number,
                        emergency_contact_number: member.emergency_contact_number,
                        blood_group: member.blood_group,
                        father_name: member.father_name,
                        mother_name: member.mother_name,
                        address: member.address,
                    }} />
                </DetailCard>
                 <DetailCard title="Proof Details">
                    <KeyValueGrid data={{
                        id_proof_type: member.id_proof_type,
                        id_number: member.id_number,
                        joining_date: member.joining_date,
                        proof_file_upload: member.proof_file_upload,
                    }} />
                </DetailCard>
                <DetailCard title="Role">
                    <KeyValueGrid data={{
                        designation: member.designation,
                        role_description: member.role_description,
                    }} />
                </DetailCard>
            </>
        )
    }
    default:
        return <DetailCard title="Information"><KeyValueGrid data={record} /></DetailCard>;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={on_back} className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {entity.name} List
        </button>
      </div>
      
      {render_content()}

    </div>
  );
};
