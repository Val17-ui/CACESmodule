import React from 'react';

type TableProps = {
  children: React.ReactNode;
  className?: string;
};

const Table: React.FC<TableProps> = ({ children, className = '' }) => {
  return (
    <div className="relative w-full overflow-auto">
      <table className={`w-full caption-bottom text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
};

type TableHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '' }) => {
  return (
    <thead className={`[&_tr]:border-b [&_tr]:border-gris-moyen ${className}`}>
      {children}
    </thead>
  );
};

type TableBodyProps = {
  children: React.ReactNode;
  className?: string;
};

const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => {
  return (
    <tbody className={`[&_tr:last-child]:border-0 ${className}`}>
      {children}
    </tbody>
  );
};

type TableFooterProps = {
  children: React.ReactNode;
  className?: string;
};

const TableFooter: React.FC<TableFooterProps> = ({ children, className = '' }) => {
  return (
    <tfoot className={`border-t border-gris-moyen bg-gris-moyen/20 font-medium [&>tr]:last:border-b-0 ${className}`}>
      {children}
    </tfoot>
  );
};

type TableRowProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

const TableRow: React.FC<TableRowProps> = ({ children, className = '', onClick }) => {
  return (
    <tr
      className={`border-b border-gris-moyen transition-colors hover:bg-gris-moyen/20 data-[state=selected]:bg-gris-moyen/30 ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

type TableHeadProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

const TableHead: React.FC<TableHeadProps> = ({ children, className = '', onClick }) => {
  return (
    <th
      className={`h-12 px-4 text-left align-middle font-medium text-texte-principal/70 [&:has([role=checkbox])]:pr-0 ${className}`}
      onClick={onClick}
    >
      {children}
    </th>
  );
};

type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  children: React.ReactNode;
  className?: string;
};

const TableCell: React.FC<TableCellProps> = ({ children, className = '', ...props }) => {
  return (
    <td className={`p-4 align-middle text-texte-principal [&:has([role=checkbox])]:pr-0 ${className}`} {...props}>
      {children}
    </td>
  );
};

type TableCaptionProps = {
  children: React.ReactNode;
  className?: string;
};

const TableCaption: React.FC<TableCaptionProps> = ({ children, className = '' }) => {
  return (
    <caption className={`mt-4 text-sm text-texte-principal/70 ${className}`}>
      {children}
    </caption>
  );
};

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
