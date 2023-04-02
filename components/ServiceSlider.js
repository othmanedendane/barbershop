import React from 'react';
import Image from 'next/image';

import { Swiper, SwiperSlide } from 'swiper/react';

import { Navigation } from 'swiper';

import 'swiper/css/navigation';
import 'swiper/css';

import Service1Icon from '../public/img/services/service-icon2.svg';
import Service2Icon from '../public/img/services/teint.png';
import Service3Icon from '../public/img/services/mask.png';


const services = [
  {
    image: Service1Icon,
    name: 'Haircut',
    description: 'Fresh haircuts, trimming & professional beard tracing ',
  },
  {
    image: Service2Icon,
    name: 'Hair dye',
    description: 'Dye your hair with a superior quality of products and materials ',
  },
  {
    image: Service3Icon,
    name: 'Facial mask & skin care',
    description: 'Everything your skin needs',
  }
]

const ServiceSlider = () => {
  return <Swiper
    slidesPerView={1}
    spaceBetween={30}
    navigation={true}
    modules={[Navigation]}
    breakpoints={{
      768: {
        slidesPerView: 2,
      },
    }}
    className='serviceSlider min-h-[680px]'
  >
    {services.map((service, index) => {
      return (
      <>
      <SwiperSlide className='border border-primary/20 bg-cream min-h-[560px] rounded-[66px] px-8'
      key={index}>
        <Image className='mb-9' src={service.image} style={{'height':"350px", 'width':"350px"}}/>
        <div className='text-[26px] font-medium mb-4'>{service.name}</div>
        <div className='text-[20px] mb-8'>{service.description}</div>
      </SwiperSlide>
      </>
      );
    })}
  </Swiper>;
};

export default ServiceSlider;
