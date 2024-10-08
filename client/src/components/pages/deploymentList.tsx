import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock, Trash2, Package } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { JobWithBuilds } from '@/types';
import { Button, buttonVariants } from '../ui/button';

interface DeploymentListProps {
  isLoading: boolean;
  jobs?: JobWithBuilds[];
  onDelete: (jobName: string) => void;
}

const EmptyState: React.FC = () => (
  <Card className='text-center p-6 dark:bg-[#0a0a0a]'>
    <CardContent className='flex flex-col items-center space-y-4'>
      <Package className='w-16 h-16 text-gray-400' />
      <h3 className='text-xl font-semibold'>No Deployments Yet</h3>
      <p className='text-gray-500 dark:text-gray-400 max-w-md'>
        You haven't created any deployments yet. Start by creating a new
        deployment to see it listed here.
      </p>
      <Link to='/deploy' className={buttonVariants({ variant: 'secondary' })}>
        Create New Deployment
      </Link>
    </CardContent>
  </Card>
);

export const DeploymentList: React.FC<DeploymentListProps> = ({
  isLoading,
  jobs,
  onDelete,
}) => {
  const navigate = useNavigate();

  const handleDeploymentClick = (name: string) => {
    navigate(`/deployment/${encodeURIComponent(name)}`);
  };

  const handleDelete = (e: React.MouseEvent, jobName: string) => {
    e.stopPropagation();
    onDelete(jobName);
  };

  const statusConfig: Record<
    string,
    { icon: React.ElementType; className: string; label: string }
  > = {
    SUCCESS: {
      icon: Check,
      className: 'text-green-500 bg-green-100 dark:bg-green-900',
      label: 'Success',
    },
    FAILURE: {
      icon: X,
      className: 'text-red-500 bg-red-100 dark:bg-red-900',
      label: 'Failed',
    },
    ABORTED: {
      icon: Clock,
      className: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900',
      label: 'In Progress',
    },
  };

  return (
    <div className='space-y-4'>
      <h2 className='text-2xl font-semibold mb-4'>Recent Deployments</h2>
      {isLoading ? (
        // Loading skeleton
        [...Array(5)].map((_, index) => (
          <Card key={index} className='dark:bg-[#0a0a0a]'>
            <CardContent className='flex items-center justify-between p-4'>
              <div className='flex items-center space-x-4'>
                <Skeleton className='h-8 w-8 rounded-full' />
                <div>
                  <Skeleton className='h-4 w-40 mb-2' />
                  <Skeleton className='h-3 w-24' />
                </div>
              </div>
              <div className='flex items-center space-x-2'>
                <Skeleton className='h-6 w-20' />
                <Skeleton className='h-6 w-16' />
              </div>
            </CardContent>
          </Card>
        ))
      ) : jobs && jobs.length > 0 ? (
        jobs.map((job) => {
          const latestBuild = job.builds?.[0];
          const status = latestBuild?.result || 'ABORTED';
          const StatusIcon = statusConfig[status]?.icon || Clock;

          return (
            <Card
              key={job.name}
              className='hover:shadow-md cursor-pointer dark:bg-[#0a0a0a] dark:hover:shadow-lg transform transition-colors duration-200 ease-in-out'
              onClick={() => handleDeploymentClick(job.name)}
            >
              <CardContent className='flex items-center justify-between p-4'>
                <div className='flex items-center space-x-4'>
                  <div
                    className={`p-2 rounded-full ${
                      statusConfig[status]?.className || ''
                    }`}
                  >
                    <StatusIcon size={20} />
                  </div>
                  <div>
                    <h3 className='font-semibold'>{job.name}</h3>
                    <p className='text-sm text-muted-foreground'>
                      Last build: #{latestBuild?.number || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className='flex items-center space-x-2'>
                  <Badge variant='outline'>Jenkins</Badge>
                  <Badge className={statusConfig[status]?.className || ''}>
                    {statusConfig[status]?.label || 'Unknown'}
                  </Badge>
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={(e) => handleDelete(e, job.name)}
                  >
                    <Trash2 className='w-4 h-4' />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <EmptyState />
      )}
    </div>
  );
};
