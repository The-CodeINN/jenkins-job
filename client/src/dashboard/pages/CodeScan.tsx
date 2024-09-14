import { ScanCodeForm } from '@/components/pages/codescan-form';

const CodeScan = () => {
  return (
    <>
      {/* <h1 className="text-lg font-semibold ml-8 mb-10">Scan Code</h1> */}
      <div className='container mx-auto flex flex-col items-center justify-start'>
        <div className='w-full max-w-md'>
          <h1 className='text-4xl font-bold text-gray-800 p-2 mb-0'>
            Scan your code
          </h1>
          <p>To deploy scan your code, import your GitHub url.</p>
          <div className='p-4 border-2 border-gray-300 rounded-md mt-4'>
            <ScanCodeForm />
          </div>
        </div>
      </div>
    </>
  );
};

export default CodeScan;
